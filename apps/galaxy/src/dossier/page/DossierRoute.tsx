import { notFound, redirect } from 'next/navigation';
import { Notice } from '../../ask/page/Notice';
import { arcadeMode } from '../../data/mode';
import { fixPageView, readPickLine, type FixPageView, type PickRead } from '../../fixes/timeline';
import { dossierGithub } from '../github/server';
import { UNREAD } from '../github/summary';
import type { GithubSummary } from '../github/summary';
import { renderMarkdown, type RenderedMarkdown } from '../markdown';
import { DEMO_VIEWER, demoContent, demoDossier } from './demo';
import { DossierPage } from './DossierPage';
import { DossierSignIn } from './DossierSignIn';
import { pulseOf, signature } from './live';
import { LiveRefresh } from './live-refresh';
import { DossierDatabaseDown, DossiersClosed, dossierSession } from './route-gate';
import { dossierCallbackPath } from './sign-in';
import { readContent, readDossier, readPlanSlices, type Db } from './source';
import { dossierView, readPick, type DossierRead } from './view';
import { kindOf, misrouted } from './work';
import type { WorkKind } from '../store';
import type { StageRow } from '../../stages/stage';
import { stageStore } from '../../stages/store';

// /prd/<id>, the page to share (PRD 216): one PRD's dossier. Rendered per request, as the signed-in
// person, so row-level security decides: signed out, a sign-in card that comes back here through
// /prd/<id>/callback; a member of the dossier's workspace, the dossier; anyone else — a member of
// another workspace, a dossier that never was — not found, in the same words. `?tab=` and `?v=` pick the
// artifact and its version. After its opener deletes a draft, `?deleted=1` says it is gone. Without a
// database it plays the demo dossier in development. With one, the page refreshes itself (PRD 384):
// LiveRefresh starts from the signature of what was read here and re-renders only when it moves. Which
// open rounds the signed-in person may answer on the list is read here too, on the server.
// For a numbered dossier and a signed-in member only, the page reads its PRD's GitHub summary (PRD 426)
// through the server's one reader, cached 60 s; a draft, a signed-out visitor and demo mode make no
// GitHub call. The stage itself (PRD 587) is read from the PRD's stored stages, as the member, beside
// that call and never waiting on it: the summary gives only the button, the links and the badge. Stages
// that could not be read show as not synced yet.
//
// PRD 627: the same page serves a fix at /visual/<id> and /bugs/<id>, each route naming the kind it
// shows. A dossier opened on another kind's route is sent to its own, the query kept (./work.ts): a fix
// at /prd/<id> goes to /visual/<id> or /bugs/<id>, and a PRD at a fix's route to /prd/<id>. A fix reads
// no GitHub summary: it has no stage.
// PRD 627, s5: a fix reads instead what GitHub says of its issue and its fix PR, through the same reader
// and 60-second cache, and — a visual fix — the pick line of its latest before/after version, for its
// State, its On GitHub links and its Timeline.

export type DossierRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** The stored stages, the GitHub summary and the plan's slice count of a numbered PRD dossier the
 * member reads; the summary is null when GitHub could not be read, the stages null when they could not
 * be read; nothing for a draft or a fix. */
async function githubOf(db: Db, read: DossierRead): Promise<{ github?: GithubSummary | null; slices?: number | null; stages?: StageRow[] | null }> {
  const { dossier } = read;
  if (dossier.prd === null || kindOf(dossier) !== 'prd') return {};
  const reader = dossierGithub();
  const logged = (error: unknown) => {
    console.error(error);
    return null;
  };
  const [github, slices, stages] = await Promise.all([
    reader ? reader.summary({ id: dossier.id, home_repo: dossier.home_repo, prd: dossier.prd }).catch(logged) : Promise.resolve(null),
    readPlanSlices(db, read.versions),
    stageStore(db).stagesOf({ workspace_id: dossier.workspace_id, repository: dossier.home_repo, prd: dossier.prd }).catch(logged),
  ]);
  return { github, slices, stages };
}

/** A fix's state, links and Timeline: GitHub through the server's reader (every moment unknown without
 * it), and a visual fix's pick line from its latest before/after version. Nothing for a PRD. */
async function fixOf(db: Db, read: DossierRead): Promise<{ fix?: FixPageView }> {
  const { dossier } = read;
  const kind = kindOf(dossier);
  if (kind === 'prd' || dossier.prd === null) return {};
  const reader = dossierGithub();
  const pages = read.versions.filter((v) => v.kind === 'before-after');
  const latest = pages[pages.length - 1];
  const [summary, pick] = await Promise.all([
    reader ? reader.fix({ id: dossier.id, home_repo: dossier.home_repo, prd: dossier.prd }).catch((error: unknown) => {
      console.error(error);
      return null;
    }) : Promise.resolve(null),
    kind !== 'visual' || !latest ? Promise.resolve<PickRead>('no-page') : readContent(db, latest.id).then(
      (html): PickRead => (html === null ? UNREAD : readPickLine(html)),
      (error: unknown): PickRead => {
        console.error(error);
        return UNREAD;
      },
    ),
  ]);
  return { fix: fixPageView(kind, summary, pick) };
}

/** The shown Spec or Plan, rendered; null when it could not be read (the pane says so). */
async function markdownOf(read: () => Promise<string | null>): Promise<RenderedMarkdown | null> {
  try {
    const content = await read();
    return content === null ? null : renderMarkdown(content);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The page of dossier `id` on `route`'s route: /prd/<id>, /visual/<id> or /bugs/<id>. */
export async function dossierRoute(route: WorkKind, { params, searchParams }: DossierRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const pick = readPick(query);
  const mode = arcadeMode(process.env);

  if (mode === 'demo') {
    // The demo's one dossier is a PRD's.
    const elsewhere = misrouted('prd', route, id, query);
    if (elsewhere) redirect(elsewhere);
    const view = dossierView(demoDossier(Date.now()), DEMO_VIEWER, pick);
    const shown = view.shown;
    const markdown = shown && !shown.frame ? await markdownOf(async () => demoContent(shown.id)) : null;
    return <DossierPage view={view} markdown={markdown} supabase={null} />;
  }
  const session = await dossierSession(mode);
  if (!session) return <DossiersClosed />;
  const { env, db, user } = session;
  if (!user) return <DossierSignIn supabase={env} returnPath={dossierCallbackPath(id)} error={one(query.signin_error)} />;

  let read: DossierRead | null;
  try {
    read = await readDossier(db, id, user.id);
  } catch (error) {
    console.error(error);
    return <DossierDatabaseDown />;
  }
  if (!read && one(query.deleted) === '1') {
    return (
      <Notice title="Draft deleted">
        <p className="ask-muted">Nothing is left of it but the questions it asked, which stay in the ask history.</p>
      </Notice>
    );
  }
  if (!read) notFound();
  const elsewhere = misrouted(kindOf(read.dossier), route, id, query);
  if (elsewhere) redirect(elsewhere);

  const [github, fix] = await Promise.all([githubOf(db, read), fixOf(db, read)]);
  const withGithub = { ...read, ...github, ...fix };
  const view = dossierView(withGithub, user.id, pick);
  const shown = view.shown;
  const markdown = shown && !shown.frame ? await markdownOf(() => readContent(db, shown.id)) : null;
  const pulse = pulseOf(withGithub);
  const live = <LiveRefresh supabase={env} id={view.id} signature={pulse ? signature(pulse) : null} />;
  return <DossierPage view={view} markdown={markdown} supabase={env} live={live} />;
}
