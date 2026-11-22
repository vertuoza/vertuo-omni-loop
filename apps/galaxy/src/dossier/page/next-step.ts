// Who acts next on a PRD's page, and what (omni-loop-20 s6): the head's words, read from what the page
// already reads, never from a new source. One subtitle names who acts and what at each moment (waiting for
// an approval or a Tech Approval, outbox items open, every answer in, building, ready, shipped, main broke,
// a draft); the one primary shows only to the person who acts, its label the subtitle's verb, the signed
// decisions linking to the review screen at /prd/<id>/review. The meta row holds at most five unlabelled
// facts and never the stage, which the stage track says once. The Actions menu holds the rare actions: Delete
// draft for a draft's opener, Request a Tech Approval. A fix's page gets the same head, with its own track.
import type { MenuItem, PageHeaderMeta } from '@omni/ui';
import type { MomentId } from '../../fixes/timeline';
import { reviewKindOf, reviewPath } from '../review/review';
import type { ReadyView } from './ready';
import { STAGES, type StageId } from './stage';
import type { DossierView } from './view';

/** The loop's stages as the stage track names them, in order. */
const TRACK_STAGES = ['Idea', 'PRD', 'Ready', 'Building', 'Outbox', 'Shipped', 'Retro'] as const;
/** A fix's stages as its track names them, in order (the moments of its Timeline). */
const FIX_TRACK_STAGES = ['Asked', 'Picked', 'Approved', 'Merged', 'Released'] as const;

const TRACK_NAME: Readonly<Record<StageId, (typeof TRACK_STAGES)[number]>> = {
  idea: 'Idea', prd: 'PRD', inbox: 'Ready', building: 'Building', outbox: 'Outbox', shipped: 'Shipped', retro: 'Retro',
};
const FIX_NAME: Readonly<Record<MomentId, (typeof FIX_TRACK_STAGES)[number]>> = {
  asked: 'Asked', picked: 'Picked', approved: 'Approved', merged: 'Merged', released: 'Released',
};

/** The one primary: a link (a signed decision on the review screen, the outbox's answers, the Main tab's
 * breaks), or the stage's own button (copy a command, the phase-0 pull request on GitHub, Pitch). */
export type Primary =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'stage' };

/** Who the current stage waits on: the viewer (`waiting`, the signal) or anyone else (`working`, the accent). */
export type Tone = 'waiting' | 'working';

export type NextStep = { lede: string | null; primary: Primary | null; tone: Tone };


const plural = (n: number, one: string, many = `${one}s`) => `${String(n)} ${n === 1 ? one : many}`;

const NOTHING = 'Nothing waits on you.';
const none = (lede: string | null): NextStep => ({ lede, primary: null, tone: 'working' });
const yours = (lede: string, primary: Primary): NextStep => ({ lede, primary, tone: 'waiting' });

/** The href of one of the page's tabs, else the page itself. */
const tabHref = (view: DossierView, kind: DossierView['tab']) => view.tabs.find((t) => t.kind === kind)?.href ?? view.link;

const review = (view: DossierView, label: string): Primary => ({ kind: 'link', label, href: reviewPath(view.id) });

/** The approval states in which a ◆ PRD waits for its product approval. */
const UNAPPROVED: ReadonlySet<string> = new Set(['waiting', 'drifted', 'voided']);

/** The words of a ◆ PRD's approval for the approver: approve it, or approve it again once it changed. */
const approveWords = (state: string) => (state === 'waiting'
  ? 'You approve the spec and plan, then the agents build it.'
  : 'It changed since it was approved: you review the change and approve it again.');

/** A ◆ PRD's signed decision that waits on someone else: the Tech Approval first, else a product approver. */
function othersApproval(approval: NonNullable<DossierView['approval']>): NextStep | null {
  const { tech } = approval;
  if (tech?.state === 'asked' && tech.waiting) return none(`${tech.name} gives the Tech Approval first. ${NOTHING}`);
  return UNAPPROVED.has(approval.state) ? none(`A product approver approves the spec and plan. ${NOTHING}`) : null;
}

/** A ◆ PRD's signed decisions: the Tech Approval, then the approval; null when none waits. */
function approvalStep(view: DossierView): NextStep | null {
  const { approval } = view;
  if (!approval) return null;
  if (approval.tech?.canGive) return yours('You review the plan and give the Tech Approval.', review(view, 'Review the plan'));
  if (approval.canApprove) return yours(approveWords(approval.state), review(view, 'Review and approve'));
  return othersApproval(approval);
}

/** The open outbox items the page shows; null when it read none. */
const openItems = (view: DossierView) => (view.outbox.state === 'items' && view.outbox.open.length > 0 ? view.outbox.open.length : null);

/** Answer the outbox: the open items counted, answered on the page's Outbox tab. */
function answerStep(view: DossierView): NextStep {
  const open = openItems(view);
  if (open === null) return yours('You answer the decisions the agents left open.', { kind: 'link', label: 'Answer the outbox', href: tabHref(view, 'outbox') });
  const what = open === 1 ? 'the decision' : `the ${String(open)} decisions`;
  return yours(`You answer ${what} the agents left open.`, { kind: 'link', label: `Answer ${plural(open, 'item')}`, href: tabHref(view, 'outbox') });
}

/** Each of the stage's buttons, by its label: who acts and what. */
const BY_ACTION: Readonly<Record<string, (view: DossierView, ready: ReadyView | null) => NextStep>> = {
  'Answer the outbox': answerStep,
  'Fix with answers': () => yours('Every answer is in: you start the fix with them.', { kind: 'stage' }),
  'Build it': () => yours('It is approved: you start the build.', { kind: 'stage' }),
  'Approve spec': () => yours('You review the spec and merge its phase-0 pull request.', { kind: 'stage' }),
  // The review screen reviews a feature the Omni App's verdict says is ready (s5, ../review/review.ts);
  // without that verdict the stage's own button opens the feature PR on GitHub.
  'Review & merge': (view, ready) => (reviewKindOf(null, ready) === 'feature'
    ? yours('The feature is ready: you review it, then merge it on GitHub.', review(view, 'Review the feature'))
    : yours('The feature is ready: you review it and merge it on GitHub.', { kind: 'stage' })),
  Pitch: (view) => ({
    lede: view.stage?.id === 'retro' ? 'Shipped, and its retro is written: you may pitch it.' : 'Shipped: the retro is written next, and you may pitch it.',
    primary: { kind: 'stage' },
    tone: 'working',
  }),
};

/** The moment the stage and its one button say, once no signed decision waits. */
function stageStep(view: DossierView, ready: ReadyView | null): NextStep {
  const { stage } = view;
  if (!stage) return none(null);
  const fixing = stage.caption?.match(/fixing on (.+)$/)?.[1];
  if (fixing) return none(`The agents fix it with your answers on ${fixing}. ${NOTHING}`);
  const step = stage.action ? BY_ACTION[stage.action.label] : undefined;
  return step ? step(view, ready) : none(quietLede(view));
}

/** The words of a moment that waits on no one in particular. */
function quietLede(view: DossierView): string | null {
  const { stage } = view;
  if (!stage) return null;
  if (stage.id === 'building' || stage.id === 'outbox') return `The agents build the slices${stage.progress ? ` (${stage.progress})` : ''}. ${NOTHING}`;
  if (stage.id === 'prd') return `The agents write the spec. ${NOTHING}`;
  if (stage.id === 'syncing') return 'Its stages are being read from GitHub.';
  return null;
}

/** A draft: its opener shapes it in the brainstorm. */
function draftStep(view: DossierView): NextStep {
  if (view.canDelete) return none('You shape this idea in the brainstorm; it gets its PRD number once written.');
  return none(`${view.openedBy?.name ?? 'Its opener'} shapes this idea in the brainstorm. ${NOTHING}`);
}

/** Who acts next and what, at the moment the page reads; a fix's page says nothing more than its track. */
export function nextStep(view: DossierView, ready: ReadyView | null = null): NextStep {
  if (view.kind !== 'prd') return none(null);
  if (view.draft) return draftStep(view);
  if (view.mainWatch?.state === 'broke') {
    return yours('It broke main after it merged: you read the breaks and the rewind’s findings.', { kind: 'link', label: 'Read the breaks', href: `${tabHref(view, 'feature')}#after-merge` });
  }
  return approvalStep(view) ?? stageStep(view, ready);
}

/** The line above the title: `PRD #216`, `PRD #216 · Product PRD`, `Draft`, or a fix's `Visual fix · #548`. */
export function eyebrowOf(view: DossierView): string {
  if (view.kind !== 'prd') return `${view.badge ?? 'Fix'} fix · ${view.heading}`;
  if (view.draft) return 'Draft';
  return view.approval ? `${view.heading} · Product PRD` : view.heading;
}

const capital = (words: string) => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

/** The meta row: at most five unlabelled facts, never the stage (the track says it) nor what the subtitle
 * says, nor what About this PRD says (who opened it, with their face). */
export function metaOf(view: DossierView): PageHeaderMeta {
  const [only] = view.repos;
  const repos = view.repos.length === 1 && only ? only : plural(view.repos.length, 'repository', 'repositories');
  const approval = view.approval;
  if (approval?.state !== 'approved') return [repos];
  return [repos, capital([approval.words, approval.detail].filter(Boolean).join(' '))];
}

/** The Actions menu: Request a Tech Approval for any member while it is allowed, Delete draft for a draft's
 * opener on a deployment with a database. Rare actions only, never a section. */
export function actionsOf(view: DossierView, canDelete: boolean): MenuItem[] {
  return [
    ...(view.approval?.canRequestTech ? [{ id: 'request-tech', label: 'Request a Tech Approval' }] : []),
    ...(canDelete ? [{ id: 'delete-draft', label: 'Delete draft', tone: 'danger' as const }] : []),
  ];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const HOUR = 3_600_000;

/** A stage's hover text: `Building since 17 Nov 09:40 UTC · 10.2 h`, in days from 48 hours on. */
export function sinceWords(stage: string, since: string, until: string | null): string {
  const from = new Date(since);
  const two = (n: number) => String(n).padStart(2, '0');
  const at = `${String(from.getUTCDate())} ${MONTHS[from.getUTCMonth()] ?? ''} ${two(from.getUTCHours())}:${two(from.getUTCMinutes())} UTC`;
  if (until === null) return `${stage} since ${at}`;
  const hours = Math.max(0, Date.parse(until) - from.getTime()) / HOUR;
  return `${stage} since ${at} · ${hours < 48 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} d`}`;
}

/** What the stage track draws: the stage, its progress words, its tone and each stage's hover time. */
export type TrackView = { stages: readonly string[]; stage: string; progress: string | undefined; tone: Tone; times: Record<string, string> };

/** A PRD's track: the stage said once, its progress, whose turn it is, and each stage reached with its time
 * (until the next stage was reached, the current one until it was last synced); null without a stage. */
export function prdTrack(view: DossierView): TrackView | null {
  const { stage } = view;
  if (!stage) return null;
  const step = nextStep(view);
  const waits = view.approval?.tech?.canGive ? 'waits for your Tech Approval' : view.approval?.canApprove ? 'waits for your approval' : null;
  const current = stage.id === 'brainstorming' ? 'Idea' : stage.id === 'syncing' ? 'Syncing…' : TRACK_NAME[stage.id];
  const progress = stage.id === 'brainstorming' || stage.id === 'idea' ? 'brainstorm in progress' : waits ?? stage.progress ?? undefined;
  const reached = STAGES.flatMap((id) => {
    const when = stage.reached[id];
    return when ? [{ name: TRACK_NAME[id], when }] : [];
  });
  const times: Record<string, string> = {};
  reached.forEach(({ name, when }, at) => {
    const next = reached[at + 1]?.when ?? stage.syncedAt;
    times[name] = name === current && stage.synced ? `${sinceWords(name, when, next)} · ${stage.synced}` : sinceWords(name, when, next);
  });
  return { stages: TRACK_STAGES, stage: current, progress, tone: step.tone, times };
}

/** A fix's track (Asked · Picked · Approved · Merged · Released, a bug fix's with no Picked): its latest moment done is its stage;
 * null when GitHub gave no moment. */
export function fixTrack(view: DossierView): TrackView | null {
  const moments = view.fix?.timeline ?? [];
  const done = moments.filter((m) => m.state === 'done');
  const last = done.at(-1);
  if (!last) return null;
  const times = Object.fromEntries(done.flatMap((m) => (m.when ? [[FIX_NAME[m.id], `${FIX_NAME[m.id]} · ${m.when}`]] : [])));
  // A bug fix has no pick: its track holds the moments its Timeline holds, in the fix's order.
  const stages = FIX_TRACK_STAGES.filter((name) => moments.some((m) => FIX_NAME[m.id] === name));
  return { stages, stage: FIX_NAME[last.id], progress: undefined, tone: 'working', times };
}
