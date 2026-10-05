import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import { serviceDb } from '../../data/sign-in-live';
import type { FixSummary } from '../github/fix';
import { mergeFacts } from '../../fixes/facts/refresh';
import { fixFactsStore } from '../../fixes/facts/store';
import { Notice } from '../../ask/page/Notice';
import { serverEnv } from '../../env';
import { fixPageView, readPickLine, type FixPageView, type PickRead } from '../../fixes/timeline';
import { dossierGithub } from '../github/server';
import { UNREAD } from '../github/summary';
import { renderMarkdown, type RenderedMarkdown } from '../markdown';
import { DEMO_VIEWER, DEMO_VOICE_CAST, demoContent, demoDossier } from './demo';
import { DossierPage } from './DossierPage';
import { DossierSignIn } from './DossierSignIn';
import { pulseOf, signature } from './live';
import { LiveRefresh } from './live-refresh';
import { DossierStream, type DossierReads } from './stream/DossierStream';
import { DossierDatabaseDown, DossiersClosed, dossierSession } from './route-gate';
import { dossierCallbackPath } from './sign-in';
import { isDossierId, readContent, readDossier, readPlanSlices, type Db } from './source';
import { dossierView, readPick, type DossierRead } from './view';
import type { VoiceCast, VoiceView } from './voice';
import { readShownVoice, readVoiceCast } from './voice-source';
import { kindOf, misrouted } from './work';
import { readDockPlayer } from './dock-player';
import { questionsHref } from './working';
import type { WorkKind } from '../store';
import { stageStore } from '../../stages/store';
import { proofStore } from '../../proof/store';
import { readProofs } from './proof-read';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

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
// PRD 657 s4: a numbered PRD's page streams (./stream/DossierStream.tsx): it is sent as soon as the
// database has answered, the parts only GitHub knows saying they are being read, then again, whole,
// when the GitHub summary arrives. A draft reads no GitHub, and a fix's page waits for its summary.
// PRD 691 s3: what a fix's page read of GitHub is stored in fix_facts, which /bugs and /visual read, as
// the service role, after the response (Next's after()): the render never waits on it, a part GitHub
// could not read keeps its stored value, and a write that fails is only logged.
// PRD 757 s4: the change check also carries whether Claude works on the dossier, and sits the play dock
// in the page's corner (LiveRefresh). Who plays is read here, as the member, beside the page's own
// reads and never before them: their GitHub link, their XP in the dossier's workspace, their hero. A
// read that fails leaves the dock out, never the page.
// PRD 822 s3: on the User voice tab, the shown voice.json version is read beside the page's own reads,
// with the workspace's personas for its portraits, never on another tab.
// PRD 798 s4: a PRD's proof runs are read as the member beside the dossier (./proof-read.ts), and on the
// Proof tab only, the shown run's clips and scripts are signed for them; runs that cannot be read leave
// the Proof tab out, never the page.

export type DossierRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

/** The GitHub summary, the plan's slice count and the stored stages of a numbered PRD dossier the member
 * reads, each started now and awaited by the page's own blocks (PRD 657 s4); the summary reads null when
 * GitHub could not be read, the stages null when they could not be read. */
function prdReads(db: Db, read: DossierRead, prd: PrdNumber): DossierReads {
  const { dossier } = read;
  const reader = dossierGithub();
  const logged = (error: unknown) => {
    console.error(error);
    return null;
  };
  return {
    github: reader ? reader.summary({ id: dossier.id, home_repo: dossier.home_repo, prd }).catch(logged) : Promise.resolve(null),
    slices: readPlanSlices(db, read.versions),
    stages: stageStore(db).stagesOf({ workspace_id: dossier.workspace_id, repository: dossier.home_repo, prd }).catch(logged),
  };
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
  if (summary) after(() => keepFacts(dossier, summary));
  return { fix: fixPageView(kind, summary, pick) };
}

/** Stores what the fix's page read of GitHub, each part it could not read kept as stored; logs a failure. */
async function keepFacts(dossier: DossierRead['dossier'], read: FixSummary): Promise<void> {
  try {
    const store = fixFactsStore(serviceDb());
    const stored = (await store.readFacts(dossier.workspace_id, [dossier.id])).get(dossier.id) ?? null;
    await store.writeFacts([{ dossier_id: dossier.id, workspace_id: dossier.workspace_id, facts: mergeFacts(stored, read) }]);
  } catch (error) {
    console.error(error);
  }
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

/** The shown Spec or Plan of `view`, rendered through `read`; null for a framed artifact, the User voice, or none. */
async function shownMarkdown(view: ReturnType<typeof dossierView>, read: (id: string) => Promise<string | null>) {
  const shown = view.shown;
  return shown && !shown.frame && view.tab !== 'voice' ? markdownOf(() => read(shown.id)) : null;
}

/** The shown User voice version of `view`, read through `read` with the personas `cast` gives; null off that tab or with none. */
async function shownVoice(view: ReturnType<typeof dossierView>, read: (id: string) => Promise<string | null>, cast: () => Promise<VoiceCast[]>): Promise<VoiceView | null> {
  const shown = view.shown;
  return shown && view.tab === 'voice' ? readShownVoice(() => read(shown.id), cast) : null;
}

type Query = Record<string, string | string[] | undefined>;

/** The demo's one dossier, a PRD's: another route is sent to /prd/<id>. */
async function demoPage(route: WorkKind, id: string, query: Query, pick: ReturnType<typeof readPick>) {
  const elsewhere = misrouted('prd', route, id, query);
  if (elsewhere) redirect(elsewhere);
  const view = dossierView(demoDossier(Date.now()), DEMO_VIEWER, pick);
  const content = (shownId: string) => Promise.resolve(demoContent(shownId));
  const [markdown, voice] = await Promise.all([shownMarkdown(view, content), shownVoice(view, content, () => Promise.resolve(DEMO_VOICE_CAST))]);
  return <DossierPage view={view} markdown={markdown} voice={voice} supabase={null} />;
}

function DraftDeleted() {
  return (
    <Notice title="Draft deleted">
      <p className="ask-muted">Nothing is left of it but the questions it asked, which stay in the ask history.</p>
    </Notice>
  );
}

/** The page of dossier `id` on `route`'s route: /prd/<id>, /visual/<id> or /bugs/<id>. */
export async function dossierRoute(route: WorkKind, { params, searchParams }: DossierRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const pick = readPick(query);
  const mode = serverEnv().mode;

  if (mode === 'demo') return demoPage(route, id, query, pick);
  const session = await dossierSession(mode);
  if (!session) return <DossiersClosed />;
  const { env, db, user } = session;
  if (!user) return <DossierSignIn supabase={env} returnPath={dossierCallbackPath(id)} error={one(query.signin_error)} />;

  let read: DossierRead | null;
  const proofs = isDossierId(id) ? readProofs(proofStore(db), id, { sign: pick.tab === 'proof', version: pick.version }) : Promise.resolve(null);
  try {
    read = await readDossier(db, id, user.id);
  } catch (error) {
    console.error(error);
    return <DossierDatabaseDown />;
  }
  if (!read && one(query.deleted) === '1') return <DraftDeleted />;
  if (!read) notFound();
  const elsewhere = misrouted(kindOf(read.dossier), route, id, query);
  if (elsewhere) redirect(elsewhere);

  const { dossier } = read;
  const dock = readDockPlayer(db, user, dossier.workspace_id).then(
    (setup) => ({ ...setup, answerHref: questionsHref(dossier.id, kindOf(dossier)) }),
    (error: unknown) => {
      console.error(error);
      return null;
    },
  );
  const live = async (seen: DossierRead) => {
    const pulse = pulseOf(seen);
    return <LiveRefresh supabase={env} id={dossier.id} signature={pulse ? signature(pulse) : null} dock={await dock} />;
  };
  const { prd } = read.dossier;
  if (prd !== null && kindOf(read.dossier) === 'prd') {
    read = { ...read, proofs: await proofs };
    // A numbered PRD streams: the page as the database has it at once, then with its GitHub summary.
    const first = dossierView(read, user.id, pick);
    const markdown = shownMarkdown(first, (shownId) => readContent(db, shownId));
    const voice = shownVoice(first, (shownId) => readContent(db, shownId), () => readVoiceCast(db, dossier.workspace_id));
    return <DossierStream read={read} me={user.id} pick={pick} reads={prdReads(db, read, prd)} markdown={markdown} voice={voice} supabase={env} live={live} />;
  }
  const withFix = { ...read, ...(await fixOf(db, read)) };
  const view = dossierView(withFix, user.id, pick);
  const markdown = await shownMarkdown(view, (shownId) => readContent(db, shownId));
  return <DossierPage view={view} markdown={markdown} supabase={env} live={await live(withFix)} />;
}
