import 'server-only';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { after } from 'next/server';
import { serviceDb } from '../../data/sign-in-live';
import type { FixSummary } from '../github/fix';
import { mergeFacts } from '../../fixes/facts/refresh';
import { fixFactsStore } from '../../fixes/facts/store';
import { bugRecordPage } from '../../fixes/bug-rows';
import { readBugRows } from '../../fixes/bug-rows.repository';
import { fixFacts } from './fix-facts';
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
import { livePageSnapshot } from '../snapshot/live';
import { DossierDatabaseDown, DossiersClosed, dossierSession } from './route-gate';
import { dossierCallbackPath } from './sign-in';
import { isDossierId, readContent, readDossier, readPlanSlices, type Db } from './source';
import { dossierView, readPick, type DossierRead } from './view';
import type { VoiceCast, VoiceView } from './voice';
import { readShownVoice, readVoiceCast } from './voice-source';
import { kindOf, misrouted, rowKind } from './work';
import { createTimings } from './timing';
import { ServerTimingMark } from './timing-mark';
import { readDockPlayer } from './dock-player';
import { questionsHref } from './working';
import type { WorkKind } from '../store';
import { stageStore } from '../../stages/store';
import { milestoneStore } from '../../timeline/store.repository';
import { proofStore } from '../../proof/store';
import { readProofs } from './proof-read';
import { pitchStore } from '../../pitch/store';
import { readPitches } from './pitch-read';
import { readProductOutbox } from './outbox-product.repository';
import { productOutboxView } from './outbox-product';
import { approvalView, readApproval, readApproveScreen, readAskedApprovers, readVoids, type ApprovalFacts, type ApprovalRead } from './approval';
import { attestationOf } from './Attestation.service';
import { liveSendSetup } from '../../runners/send/send.live';
import { continuationsRepository, runnersRepository } from '../../runners/runners.repository';
import { fixingOf, type Fixing } from './stage';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';

// /prd/<id>, the page to share (PRD 216): one PRD's dossier. Rendered per request, as the signed-in
// person, so row-level security decides: signed out, a sign-in card that comes back here through
// /prd/<id>/callback; a member of the dossier's workspace, the dossier; anyone else — a member of
// another workspace, a dossier that never was — not found, in the same words. `?tab=` and `?v=` pick the
// artifact and its version. After its opener deletes a draft, `?deleted=1` says it is gone. Without a
// database it plays the demo dossier in development. With one, the page refreshes itself (PRD 384):
// LiveRefresh starts from the signature of what was read here and re-renders only when it moves. Which
// open rounds the signed-in person may answer on the list is read here too, on the server.
// For a numbered dossier and a signed-in member only, the page reads its PRD's GitHub summary (PRD 426)
// from its stored snapshot (PRD 902, s2, ../snapshot/): a first visit reads GitHub once, interactively,
// and a stale snapshot is refreshed after the response; a draft, a signed-out visitor and demo mode make no
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
// PRD 902 s2: a fix's page renders from its stored facts, read as the member (./fix-facts.ts), and reads
// GitHub only after the response while they are not final; with none stored, it reads GitHub once.
// PRD 757 s4: the change check also carries whether Claude works on the dossier, and sits the play dock
// in the page's corner (LiveRefresh). Who plays is read here, as the member, beside the page's own
// reads and never before them: their GitHub link, their XP in the dossier's workspace, their hero. A
// read that fails leaves the dock out, never the page.
// PRD 822 s3: on the User voice tab, the shown voice.json version is read beside the page's own reads,
// with the workspace's personas for its portraits, never on another tab.
// PRD 798 s4: a PRD's proof runs are read as the member beside the dossier (./proof-read.ts), and on the
// Proof tab only, the shown run's clips and scripts are signed for them; runs that cannot be read leave
// the Proof tab out, never the page.
// PRD 859 s3: its pitches are read the same way (./pitch-read.ts), and on the Pitch tab only the shown
// pitch of each audience has its five files signed; pitches that cannot be read leave the tab out.
// PRD 1299 s3: a numbered PRD born on the server (◆) has its approval in force read as the member beside
// the page's own reads (./approval.ts); one that cannot be read says so on the page, never hides it. A PRD
// born in the repository (◇) reads none.
// PRD 1322 s7: beside it, the dossier's voids and the members its product asks to approve; for a viewer
// who gets Approve, the approve screen too: the changed files' diffs and the spec's Problem and Solution.
// Voids that cannot be read leave the approval unread; approvers that cannot be read leave the button to
// any member, and dossier_approve() decides.
// PRD 1548 s4: a product PRD's attestation is read as the member beside it (./Attestation.service.ts); one
// that cannot be read is left out, never the page.
// PRD 1830 s4: a numbered PRD's page reads, beside its approval, the workspace's runners the viewer may
// send to that hold its repository (../../runners/send/send.live.ts), for Send to terminal beside each
// button that copies a line a runner runs. None, or a read that fails, leaves the button out, never the page.
// PRD 2270 s4: it also reads the PRD's /omni:yolo-fix job while queued or running, for the status line's
// `fixing on <runner>`; a read that fails leaves the line as it was, never hides the page.

export type DossierRouteProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

const logged = <T,>(fallback: T) => (error: unknown): T => {
  console.error(error);
  return fallback;
};

/** A ◆ PRD's approval in force, `unread` when it or its voids could not be read, with its voids, who the
 * product asks to approve (`unread` when that could not be read), and, for `me` when they get the
 * button, the approve screen (PRD 1322 s7); nothing for any other dossier. */
async function approvalOf(db: Db, read: DossierRead, me: string): Promise<Pick<DossierRead, 'approval' | 'approvalFacts'>> {
  const { dossier } = read;
  if (dossier.birthplace !== 'server') return {};
  const [row, voids, asked] = await Promise.all([
    readApproval(db, dossier.id).catch(logged<ApprovalRead>('unread')),
    readVoids(db, dossier.id).catch(logged(null)),
    readAskedApprovers(db, dossier).catch(logged<'unread'>('unread')),
  ]);
  const approval: ApprovalRead = voids === null ? 'unread' : row;
  const facts: ApprovalFacts = { voids: voids ?? [], asked };
  const view = approvalView({ ...read, approval, approvalFacts: facts }, me);
  if (!view?.canApprove) return { approval, approvalFacts: facts };
  const screen = await readApproveScreen((id) => readContent(db, id), read.versions, approval, view);
  return { approval, approvalFacts: { ...facts, screen } };
}

/** The runner the PRD's fix job is queued or running on (PRD 2270); null when none is, or the jobs could not be read. */
async function fixingRead(dossier: DossierRead['dossier'], prd: PrdNumber): Promise<Fixing | null> {
  try {
    const db = serviceDb();
    const jobs = await continuationsRepository(db).prdJobs(dossier.workspace_id, dossier.home_repo, prd);
    // PRD 2401 s4: the runners of those jobs are read in one query, not one each.
    const ids = [...new Set(jobs.flatMap((job) => (job.runner_id === null ? [] : [job.runner_id])))];
    const names = new Map((await runnersRepository(db).runnersByIds(ids)).map((runner): [string, string] => [runner.id, runner.name]));
    return fixingOf(prd, jobs.map((job) => ({ ...job, runner: job.runner_id === null ? null : names.get(job.runner_id) ?? null })));
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The GitHub summary, the plan's slice count and the stored stages of a numbered PRD dossier the member
 * reads, each started now and awaited by the page's own blocks (PRD 657 s4); the summary reads null when
 * GitHub could not be read, the stages null when they could not be read. */
function prdReads(db: Db, read: DossierRead, prd: PrdNumber): DossierReads {
  const { dossier } = read;
  const logged = (error: unknown) => {
    console.error(error);
    return null;
  };
  const snapshot = livePageSnapshot({ id: dossier.id, workspace_id: dossier.workspace_id, home_repo: dossier.home_repo, prd })
    .catch((error: unknown) => ({ summary: logged(error), at: null }));
  return {
    github: snapshot.then((s) => s.summary),
    githubAt: snapshot.then((s) => s.at),
    slices: readPlanSlices(db, read.versions),
    stages: stageStore(db).stagesOf({ workspace_id: dossier.workspace_id, repository: dossier.home_repo, prd }).catch(logged),
    milestones: milestoneStore(db).milestonesOf({ workspace_id: dossier.workspace_id, repository: dossier.home_repo, prd }).catch(logged),
  };
}

/** A fix's state, links and Timeline: its stored facts, else GitHub through the server's reader (every
 * moment unknown without either), and a visual fix's pick line from its latest before/after version. Nothing for a PRD. */
async function fixOf(db: Db, read: DossierRead): Promise<{ fix?: FixPageView }> {
  const { dossier } = read;
  const kind = kindOf(dossier);
  if (kind === 'prd') return {};
  // A product bug (PRD 2011, s8) has no issue: its page reads its Fixes rows.
  if (dossier.prd === null) {
    const rows = kind === 'bug' ? await readBugRows(db, dossier.id) : null;
    return rows ? { fix: bugRecordPage(rows) } : {};
  }
  const reader = dossierGithub();
  const ref = { id: dossier.id, home_repo: dossier.home_repo, prd: dossier.prd };
  const pages = read.versions.filter((v) => v.kind === 'before-after');
  const latest = pages[pages.length - 1];
  const [summary, pick] = await Promise.all([
    fixFacts({
      stored: async () => (await fixFactsStore(db).readFacts(dossier.workspace_id, [dossier.id])).get(dossier.id) ?? null,
      read: (priority) => (reader ? reader.fix(ref, { priority }).catch((error: unknown) => {
        console.error(error);
        return null;
      }) : Promise.resolve(null)),
      keep: (facts) => keepFacts(dossier, facts),
      later: (task) => { after(task); },
    }),
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

/** A product PRD's outbox on its Outbox tab, from the server's rows (PRD 2011 s15); null off that tab, for any other dossier, or when the rows cannot be read. */
async function productOutboxOf(db: Db, dossier: DossierRead['dossier'], tab: string) {
  if (tab !== 'outbox' || dossier.prd !== null || kindOf(dossier) !== 'prd') return null;
  const rows = await readProductOutbox(db, dossier.id, dossier.title);
  return rows === null ? null : productOutboxView(rows);
}

/** The change check of a numbered PRD's page, outside what waits for the approval, Send to terminal and the runner, so it stays mounted. */
async function LivePart({ live, read }: { live: (read: DossierRead) => Promise<ReactNode>; read: DossierRead }) {
  return <>{await live(read)}</>;
}

/** The page's shell: as the database has it, with nothing of a ◆ PRD's approval, which the page says as soon as it is read. */
export const shellOf = (read: DossierRead): DossierRead => (
  read.dossier.birthplace === 'server' ? { ...read, dossier: { ...read.dossier, birthplace: 'repo' } } : read
);

async function Settled<T>({ late, children }: { late: Promise<T>; children: (late: T) => ReactNode }) {
  return <>{children(await late)}</>;
}

export interface WithLatePartsProps<T> {
  late: Promise<T>;
  shell: ReactNode;
  /** The change check, from the page `read` as the database has it: beside what waits, never inside it. */
  live: (read: DossierRead) => Promise<ReactNode>;
  read: DossierRead;
  children: (late: T) => ReactNode;
}

/** Sends `shell` at once and, once `late` has settled, the page `children` makes of it in its place (PRD 2401 s4). */
export function WithLateParts<T>({ late, shell, live, read, children }: WithLatePartsProps<T>) {
  return (
    <>
      <Suspense fallback={null}><LivePart live={live} read={read} /></Suspense>
      <Suspense fallback={shell}><Settled late={late}>{children}</Settled></Suspense>
    </>
  );
}

/** The page of dossier `id` on `route`'s route: /prd/<id>, /visual/<id> or /bugs/<id>. */
export async function dossierRoute(route: WorkKind, { params, searchParams }: DossierRouteProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const pick = readPick(query);
  const timings = createTimings(); // PRD 2401 s1: the page's reads, each by name
  const mode = serverEnv().mode;

  if (mode === 'demo') return demoPage(route, id, query, pick);
  const session = await timings.time('viewer', dossierSession(mode));
  if (!session) return <DossiersClosed />;
  const { env, db, user } = session;
  if (!user) return <DossierSignIn supabase={env} returnPath={dossierCallbackPath(id)} error={one(query.signin_error)} />;

  let read: DossierRead | null;
  const proofs = isDossierId(id) ? readProofs(proofStore(db), id, { sign: pick.tab === 'proof', version: pick.version }) : Promise.resolve(null);
  const pitches = isDossierId(id) ? readPitches(pitchStore(db), id, { sign: pick.tab === 'pitch', pitch: pick.pitch ?? null }) : Promise.resolve(null);
  try {
    read = await readDossier(db, id, user.id, timings);
  } catch (error) {
    console.error(error);
    return <DossierDatabaseDown />;
  }
  if (!read && one(query.deleted) === '1') return <DraftDeleted />;
  if (!read) notFound();
  // A product roadmap's dossier (PRD 2011) has its page under /roadmaps, which finds it by its dossier's id too.
  if (rowKind(read.dossier) === null && String(read.dossier.kind) === 'roadmap') redirect(`/roadmaps/${encodeURIComponent(id)}`);
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
    const github = seen.dossier.prd !== null && kindOf(seen.dossier) === 'prd';
    return <LiveRefresh supabase={env} id={dossier.id} signature={pulse ? signature(pulse) : null} dock={await dock} github={github} />;
  };
  const { prd } = read.dossier;
  if (prd !== null && kindOf(read.dossier) === 'prd') {
    // PRD 2401 s4: the approval, Send to terminal and the fixing runner are started now and awaited by a
    // Suspense of their own below: the page's shell is sent without them.
    const late = Promise.all([
      timings.time('approval', approvalOf(db, read, user.id)),
      timings.time('send', liveSendSetup(user.id, dossier.workspace_id, dossier.home_repo)),
      timings.time('fixing', fixingRead(dossier, prd)),
    ]);
    read = { ...read, proofs: await timings.time('proofs', proofs), pitches: await timings.time('pitches', pitches) };
    // A numbered PRD streams: the page as the database has it at once, then with its GitHub summary.
    const first = dossierView(read, user.id, pick);
    const markdown = shownMarkdown(first, (shownId) => readContent(db, shownId));
    const voice = shownVoice(first, (shownId) => readContent(db, shownId), () => readVoiceCast(db, dossier.workspace_id));
    const reads = prdReads(db, read, prd);
    const page = (seen: DossierRead, send: Awaited<typeof late>[1], timing: ReactNode) => (
      <DossierStream read={seen} me={user.id} pick={pick} reads={reads} markdown={markdown} voice={voice} supabase={env} live={() => null} send={send} timing={timing} />
    );
    const base = read;
    return (
      <WithLateParts late={late} shell={page(shellOf(base), null, null)} live={live} read={base}>
        {([approval, send, fixing]) => page({ ...base, ...approval, fixing }, send, <ServerTimingMark timings={timings} />)}
      </WithLateParts>
    );
  }
  const withFix = { ...read, ...(await fixOf(db, read)) };
  const view = dossierView(withFix, user.id, pick);
  const [markdown, attestation, productOutbox] = await Promise.all([
    shownMarkdown(view, (shownId) => readContent(db, shownId)), attestationOf(db, read.dossier), productOutboxOf(db, read.dossier, view.tab),
  ]);
  return <DossierPage view={view} markdown={markdown} supabase={env} live={await live(withFix)} attestation={attestation} productOutbox={productOutbox} />;
}
