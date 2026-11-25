import { RepairClassSchema } from 'omni-loop/kit/lib/repair/retro.ts';
import { scrub } from 'omni-loop/kit/lib/repair/scrub.ts';
import type { Target } from '../../runners/runners.contract';
import { UPDATE_COMMAND } from '../../runners/page/health';
import type { SupervisorRefusal } from '../api/supervisor.contract';
import {
  BugTargetSchema, JOB_ENDED, JOB_GONE, isLinkAction, JobTargetSchema, MISSION_GONE, MissionTargetSchema, OWNERS_ONLY, PRESSED_ACTIONS, RESUME_QUEUED,
  RUNNER_GONE, RunnerTargetSchema, STOP_ASKED, type Dismissed, type Outcome, type PressedAction, type Pressed,
} from './proposals.contract';
import type { JobRow, LedgerJob, ProposalActs, ProposalRow, ProposalsStore } from './proposals.repository';

// The rules of an owner's press of a Supervisor suggestion, and of their Not a problem (PRD omni-loop-34 s7, spec "4.
// Findings and suggestions"):
//
// - Who: only an owner of the workspace acts; a member's press is refused before anything is written (AC-3), and the
//   database's owner-checked function refuses anyone else again. The press is recorded once, as that owner, before it is
//   carried out (supervisor_proposal_approve(); BR-PRODUCT-12): a suggestion pressed already answers its first result.
// - What: each action goes through what the App already does, as the owner who pressed (`Carry`, the routes of today
//   called with their session): Stop and resume is the Runners page's Cancel, then its Send again of the same line to
//   where the job first went; Pause and Resume a mission are the mission page's; Wake its supervisor refreshes the
//   mission's job on the App's ledger (ADR-0141); a bug fix is the `bug-report` job of the App's ledger, scrubbed first,
//   which files it on the Omni Loop repository once per fingerprint; cleaning merged worktrees and updating a runner's kit
//   are run on the runner, so the press answers the steps to copy.
// - A suggestion that no longer applies is refused with its reason and its finding closes as resolved: the job ended or
//   is gone, someone asked it to stop already, or a lost job's automatic resume exists (AC-4, BR-PRODUCT-136: its work is
//   never queued twice; BR-PRODUCT-134: a job whose cancel was asked is never resumed on its own, so the press's own
//   Send again is its one resume). A route of today that refuses (a mission that cannot pause) is the same.
// - Done, the finding closes as acted. A failure (the App could not answer) leaves it open.
// - Every press ends with one result row and one line in the finding's thread, naming who pressed and what came of it.

export type Served<T> = { ok: true; value: T } | { ok: false; kind: SupervisorRefusal; error: string };
type Refused = Extract<Served<never>, { ok: false }>;

/** What a route of today answered: its value, or its status and words. */
export type Called<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** The routes of today, as the owner who pressed. */
export type Carry = {
  cancelJob: (job: string) => Promise<Called<unknown>>;
  sendJob: (send: { line: string; repo: string; target: Target }) => Promise<Called<{ id: string }>>;
  moveMission: (action: 'pause' | 'resume', mission: string) => Promise<Called<unknown>>;
  /** Wakes the mission's supervisor now: false for a mission that is not running, waiting or paused. */
  wakeMission: (mission: string) => Promise<boolean>;
};

export type ProposalsServiceDeps = { store: ProposalsStore; carry: Carry; clock: { now: () => Date } };

/** The refusals a press or a dismissal answers before anything is written, by name. */
const REFUSE = {
  notMember: { ok: false, kind: 'forbidden', error: 'You are not a member of this workspace.' },
  notOwner: { ok: false, kind: 'forbidden', error: OWNERS_ONLY },
  noSuggestion: { ok: false, kind: 'missing', error: 'No such suggestion.' },
  noFinding: { ok: false, kind: 'missing', error: 'No such finding.' },
  link: { ok: false, kind: 'malformed', error: 'This suggestion is a link: the page opens it, nothing is pressed.' },
  outOfShape: { ok: false, kind: 'malformed', error: 'This suggestion does not name what it acts on: the Supervisor wrote it out of shape.' },
} as const satisfies Record<string, Refused>;

/** The database's refusal of an owner's act, in its words. */
const actRefused = (refusal: 'forbidden' | 'refused', error: string): Refused => ({ ok: false, kind: refusal === 'forbidden' ? 'forbidden' : 'conflict', error });

const NOT_WOKEN = 'The mission is not running, waiting or paused: there is nothing to wake';
const NOTE_MAX = 500;

/** The Omni Loop repository a bug report is filed on, and the ledger's kind and lane for it (apps/omni-app/src/bug-reports/job.ts). */
const BUG_REPORT = { kind: 'bug-report', lane: 'bug-report', repo: 'vertuoza/vertuo-omni-loop' } as const;
/** The Supervisor signs the bug fixes it opens (L-AIACT-1): an agent's. */
const BUG_SIGNATURE = 'Opened by the Supervisor, an agent:';
const PRUNE_COMMAND = 'omni worktrees prune';

const ENDED = new Set(['done', 'failed', 'cancelled']);
const OUTCOME_WORDS: Record<Outcome, string> = { done: 'Done', refused: 'Refused', failed: 'Failed' };

type Result = { outcome: Outcome; note: string; steps: string | null };

const done = (note: string, steps: string | null = null): Result => ({ outcome: 'done', note, steps });
const refused = (note: string): Result => ({ outcome: 'refused', note, steps: null });
/** What a refusal of a route of today means: the App could not answer (failed), or the act no longer applies (refused). */
const outcomeOf = (called: { status: number; error: string }, before = ''): Result =>
  ({ outcome: called.status >= 500 ? 'failed' : 'refused', note: `${before}${called.error}`, steps: null });

const short = (id: string) => id.slice(0, 8);
const cut = (text: string) => (text.length <= NOTE_MAX ? text : `${text.slice(0, NOTE_MAX - 1).trimEnd()}…`);

/** Where a job first went, as Send again sends it there again. */
function targetOf({ to_runner: runner, to_fleet: fleet }: JobRow): Target {
  if (runner === null && fleet === null) return { kind: 'any' };
  return runner === null ? { kind: 'fleet', fleet: fleet ?? '' } : { kind: 'runner', runner };
}

const pressedAction = (action: string | null): PressedAction | null => PRESSED_ACTIONS.find((known) => known === action) ?? null;

/** Whether a suggestion's target names what its action acts on. */
function targetFits(action: PressedAction, target: unknown): boolean {
  if (action === 'stop-resume-job') return JobTargetSchema.safeParse(target).success;
  if (action === 'open-bug-fix') return BugTargetSchema.safeParse(target).success;
  if (action === 'clean-worktrees' || action === 'copy-kit-update') return RunnerTargetSchema.safeParse(target).success;
  return MissionTargetSchema.safeParse(target).success;
}

export function proposalsService({ store, carry, clock }: ProposalsServiceDeps) {
  const iso = () => clock.now().toISOString();

  /** An owner of the workspace, or why not. */
  async function ownerOf(workspace: string, caller: string): Promise<Refused | null> {
    const role = await store.role(workspace, caller);
    if (role === null) return REFUSE.notMember;
    return role === 'owner' ? null : REFUSE.notOwner;
  }

  /** The suggestion an owner may press, with its action, or why not: before anything is written. */
  async function pressable(workspace: string, proposal: string): Promise<{ suggestion: ProposalRow; action: PressedAction } | Refused> {
    const suggestion = await store.proposal(workspace, proposal);
    if (suggestion?.kind !== 'suggestion') return REFUSE.noSuggestion;
    if (isLinkAction(suggestion.action)) return REFUSE.link;
    const action = pressedAction(suggestion.action);
    return action !== null && targetFits(action, suggestion.target) ? { suggestion, action } : REFUSE.outOfShape;
  }

  /** Carries the press out once, keeps its result, closes the finding unless it failed, and posts the result in the thread. */
  async function settle(workspace: string, suggestion: ProposalRow, action: PressedAction, press: ProposalRow): Promise<Pressed> {
    const result = await carryOut(workspace, action, suggestion);
    const note = cut(result.note);
    const row = await store.insertResult({ workspace_id: workspace, finding_id: suggestion.finding_id, reply_to: press.id, outcome: result.outcome, note });
    if (result.outcome !== 'failed') await store.close(suggestion.finding_id, result.outcome === 'done' ? 'acted' : 'resolved', iso());
    const body = `${press.author_login ?? 'An owner'} pressed “${suggestion.label ?? action}”. ${OUTCOME_WORDS[result.outcome]}: ${note}`;
    await store.postResult({ workspace_id: workspace, finding_id: suggestion.finding_id, body });
    return pressedOf(workspace, suggestion, action, press, row, result.steps);
  }

  /** Stop and resume: Cancel, then Send again of the same line to where it first went, as the owner. */
  async function stopResume(workspace: string, jobId: string): Promise<Result> {
    const job = await store.job(workspace, jobId);
    if (job === null) return refused(JOB_GONE);
    if ((await store.resumeOf(job.id)) !== null) return refused(RESUME_QUEUED);
    if (ENDED.has(job.status)) return refused(JOB_ENDED);
    if (job.cancel_requested) return refused(STOP_ASKED);
    const cancelled = await carry.cancelJob(job.id);
    if (!cancelled.ok) return outcomeOf(cancelled);
    const sent = await carry.sendJob({ line: job.line, repo: job.repo, target: targetOf(job) });
    if (!sent.ok) return { ...outcomeOf(sent, `Stopped job ${short(job.id)}, but sending it again was refused: `), outcome: 'failed' };
    return done(`Stopped job ${short(job.id)} and sent it again as job ${short(sent.value.id)}.`);
  }

  async function moveMission(workspace: string, action: 'pause' | 'resume', mission: string): Promise<Result> {
    if (!(await store.missionIn(workspace, mission))) return refused(MISSION_GONE);
    const moved = await carry.moveMission(action, mission);
    if (!moved.ok) return outcomeOf(moved);
    return done(action === 'pause' ? 'The mission is paused: nothing new is sent.' : 'The mission is running again.');
  }

  async function wakeMission(workspace: string, mission: string): Promise<Result> {
    if (!(await store.missionIn(workspace, mission))) return refused(MISSION_GONE);
    return (await carry.wakeMission(mission)) ? done('Its supervisor looks at the mission now.') : refused(NOT_WOKEN);
  }

  /** A bug fix: the report scrubbed, then queued once on the App's ledger, which files it on the Omni Loop repository. */
  async function bugFix(proposal: ProposalRow, target: unknown): Promise<Result> {
    const bug = BugTargetSchema.parse(target);
    const kind = RepairClassSchema.safeParse(bug.class);
    if (!kind.success) return refused(`The report was not sent: ${bug.class} is not a kind of failure`);
    const scrubbed = scrub({ kitVersion: bug.kitVersion, command: bug.command, class: kind.data, message: `${BUG_SIGNATURE} ${bug.message}`, fingerprint: bug.fingerprint });
    if (!scrubbed.ok) return refused(`The report was not sent: ${scrubbed.reason}`);
    const { report } = scrubbed;
    const job: LedgerJob = {
      kind: BUG_REPORT.kind, key: `bug-report:${report.fingerprint}:supervisor-${proposal.id}`, subject: BUG_REPORT.repo, payload: { report }, lane: BUG_REPORT.lane,
    };
    await store.addLedgerJob(job);
    return done(`Bug report ${report.fingerprint.slice(0, 8)} queued, opened by the Supervisor: it is filed on ${BUG_REPORT.repo} once, a repeat counted on its issue.`);
  }

  /** Steps a person runs on the runner: the press answers them to copy. */
  async function steps(workspace: string, runner: string, command: string, what: string): Promise<Result> {
    const name = await store.runnerName(workspace, runner);
    return name === null ? refused(RUNNER_GONE) : done(`To ${what}, run on ${name}: ${command}`, command);
  }

  function carryOut(workspace: string, action: PressedAction, suggestion: ProposalRow): Promise<Result> {
    const target: unknown = suggestion.target;
    switch (action) {
      case 'stop-resume-job': return stopResume(workspace, JobTargetSchema.parse(target).job);
      case 'pause-mission': return moveMission(workspace, 'pause', MissionTargetSchema.parse(target).mission);
      case 'resume-mission': return moveMission(workspace, 'resume', MissionTargetSchema.parse(target).mission);
      case 'wake-mission': return wakeMission(workspace, MissionTargetSchema.parse(target).mission);
      case 'open-bug-fix': return bugFix(suggestion, target);
      case 'clean-worktrees': return steps(workspace, RunnerTargetSchema.parse(target).runner, PRUNE_COMMAND, 'clean its merged worktrees');
      case 'copy-kit-update': return steps(workspace, RunnerTargetSchema.parse(target).runner, UPDATE_COMMAND, 'update its kit');
    }
  }

  /** The press as it ended, from its result row. */
  async function pressedOf(workspace: string, suggestion: ProposalRow, action: PressedAction, press: ProposalRow, result: ProposalRow, steps: string | null): Promise<Pressed> {
    const state = (await store.findingState(workspace, suggestion.finding_id)) ?? 'open';
    return {
      proposal: suggestion.id, action, outcome: result.outcome ?? 'failed', note: result.note ?? '', by: press.author_login ?? 'an owner',
      finding: { id: suggestion.finding_id, state }, steps,
    };
  }

  return {
    /** An owner presses a suggestion: recorded as theirs, carried out through today's route as them, its result kept and posted. */
    async press(caller: string, workspace: string, proposal: string, acts: ProposalActs): Promise<Served<Pressed>> {
      const refused = await ownerOf(workspace, caller);
      if (refused) return refused;
      const found = await pressable(workspace, proposal);
      if ('ok' in found) return found;
      const approved = await acts.approve(found.suggestion.id);
      if (!approved.ok) return actRefused(approved.refusal, approved.error);
      const first = await store.replyOf(approved.value.id);
      const pressed = first === null
        ? await settle(workspace, found.suggestion, found.action, approved.value)
        : await pressedOf(workspace, found.suggestion, found.action, approved.value, first, null);
      return { ok: true, value: pressed };
    },

    /** An owner says Not a problem: the finding closes as dismissed, with the evidence it dismissed, so the same is never raised again. */
    async dismiss(caller: string, workspace: string, finding: string, reason: string | null, acts: ProposalActs): Promise<Served<Dismissed>> {
      const refused = await ownerOf(workspace, caller);
      if (refused) return refused;
      if ((await store.findingState(workspace, finding)) === null) return REFUSE.noFinding;
      const dismissed = await acts.dismiss(finding, reason === null || reason === '' ? null : reason);
      if (!dismissed.ok) return actRefused(dismissed.refusal, dismissed.error);
      return { ok: true, value: { finding, by: dismissed.value.author_login ?? 'an owner', reason: dismissed.value.note } };
    },
  };
}

export type ProposalsService = ReturnType<typeof proposalsService>;

/** An owner's press and dismissal, as the controller hands them to the service. */
export type { ProposalActs };
