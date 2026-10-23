import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { findingKey, type RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import type { MainWatchRead } from '../main-watch/store';
import { approvalOf, leakOf, type ApprovalPlan, type KnowledgeProposal } from './rewind.approval';
import type { DecidableFinding, DecisionRefusal, DecisionReply, FindingView, FollowUp, OutcomeBody, RewindRefusal } from './rewind.contract';

// The rewind's rules (PRD 2410, s5; ADR-0095): what a member of a PRD's workspace reads of its watch, and
// what the rewind may propose.
//
// - The workspace is the one whose watch the caller can read: a PRD nobody the caller shares a workspace
//   with watches reads as no watch, never as another workspace's (BR-PRODUCT-63).
// - A finding is proposed once: the same check, origin and evidence of a PRD is one finding, whatever
//   became of it, so a rejected one is never proposed again (BR-PRODUCT-12). The first repeat is refused,
//   naming the finding, and nothing of the push is kept.
// - Nothing of a finding is decided here: a decision is the database's function, a member's, on the page.

/** What the service asks of its storage. */
export type RewindPorts = {
  /** The workspace that holds the PRD's watch in `repo`, as the caller reads it; null when none. */
  workspaceOf(repo: string, prd: PrdNumber): Promise<string | null>;
  mainWatch(workspace: string, repo: string, prd: PrdNumber): Promise<MainWatchRead>;
  findings(workspace: string, repo: string, prd: PrdNumber): Promise<FindingView[]>;
  insert(workspace: string, repo: string, prd: PrdNumber, findings: readonly RewindFinding[]): Promise<'ok' | 'duplicate'>;
  /** The workspace of the finding `id`, as the caller reads it; null when they read none. */
  workspaceOfFinding(id: string): Promise<string | null>;
  /** Records the finding's outcome as the caller; why the database refused it, or null. */
  recordOutcome(workspace: string, id: string, body: OutcomeBody): Promise<{ kind: RewindRefusal; error: string } | null>;
};

type RewindFacts = MainWatchRead & { findings: FindingView[] };

/** A service answer: its value, or why it was refused, in plain words. */
type Outcome<T> = { ok: true; value: T } | { ok: false; kind: RewindRefusal; error: string };

const refused = (kind: RewindRefusal, error: string): { ok: false; kind: RewindRefusal; error: string } => ({ ok: false, kind, error });

export function rewindService(ports: RewindPorts) {
  return {
    /** The PRD's watch, its breaks and its findings; empty when it holds no watch. */
    async facts(repo: string, prd: PrdNumber): Promise<Outcome<RewindFacts>> {
      const workspace = await ports.workspaceOf(repo, prd);
      if (workspace === null) return { ok: true, value: { watches: [], breaks: [], findings: [] } };
      const [watch, findings] = await Promise.all([ports.mainWatch(workspace, repo, prd), ports.findings(workspace, repo, prd)]);
      return { ok: true, value: { ...watch, findings } };
    },

    /** Proposes `findings` for the PRD, all or none. */
    async propose(repo: string, prd: PrdNumber, findings: readonly RewindFinding[]): Promise<Outcome<{ added: number }>> {
      const workspace = await ports.workspaceOf(repo, prd);
      if (workspace === null) return refused('missing', `PRD ${String(prd)} has no watch on main in ${repo}: there is nothing to rewind.`);
      const known = new Set((await ports.findings(workspace, repo, prd)).map(findingKey));
      const again = findings.findIndex((f) => known.has(findingKey(f)));
      const repeated = findings[again];
      if (repeated) return refused('duplicate', `Finding ${String(again + 1)} (${repeated.check}, ${repeated.origin}) was already proposed for PRD ${String(prd)}.`);
      if ((await ports.insert(workspace, repo, prd, findings)) === 'duplicate') {
        return refused('duplicate', `A finding of this push was already proposed for PRD ${String(prd)}.`);
      }
      return { ok: true, value: { added: findings.length } };
    },

    /** Records, once, what was done with the approved finding `id` (PRD 2498, s2). A finding of another
     * workspace reads as no finding (BR-PRODUCT-63); a second outcome, or one on a finding not approved, is the
     * database's refusal, since it locks the finding (BR-PRODUCT-12). */
    async outcome(id: string, body: OutcomeBody): Promise<Outcome<{ outcome: OutcomeBody['outcome'] }>> {
      const workspace = await ports.workspaceOfFinding(id);
      if (workspace === null) return refused('missing', 'No such finding on a PRD of your workspace.');
      const no = await ports.recordOutcome(workspace, id, body);
      return no ? refused(no.kind, no.error) : { ok: true, value: { outcome: body.outcome } };
    },
  };
}

export type RewindService = ReturnType<typeof rewindService>;

// ── A member's decision (PRD 2410, s7) ──────────────────────────────────────────────────────────────────
//
// A member approves or rejects a proposed finding once (BR-PRODUCT-12): the decision is the database's
// function's, which locks the finding and refuses a second one, so it is recorded first and only then does
// Approve send its work (./rewind.approval.ts). Two members clicking at once send it once: the second is
// refused before anything leaves. A follow-up that fails after the decision keeps the decision, and the card
// says what was not sent and what to run instead; it is never retried by a second Approve.
//
// An Omni-setup finding leaves the workspace as an issue on the kit's repository, so one that names the
// workspace's repository is refused before it is decided (constituent never#5): a member can still reject it.

/** What a follow-up port answers: sent, with where to see it, or why not in plain words. */
export type Sent = { ok: true; link: string | null } | { ok: false; error: string };

/** What the decision asks of its storage and of what Approve sends. */
export type DecisionPorts = {
  /** The finding, as the member reads it; null when they read none. */
  finding(id: string): Promise<DecidableFinding | null>;
  approve(workspace: string, id: string): Promise<DecisionRefusal | null>;
  reject(workspace: string, id: string, reason: string | null): Promise<DecisionRefusal | null>;
  /** Queues `line` on a runner of the workspace, sent by the member. */
  queue(repository: string, line: string): Promise<Sent>;
  /** Files a product knowledge proposal as the member, on the repository's product. */
  propose(workspace: string, repository: string, plan: KnowledgeProposal): Promise<Sent>;
  /** Opens one issue on the kit's repository. */
  openIssue(title: string, body: string): Promise<Sent>;
  log(line: string): void;
};

const REFUSED: Readonly<Record<DecisionRefusal, RewindRefusal>> = { missing: 'missing', decided: 'decided', 'not-member': 'not-allowed' };
const NO_FINDING = 'No such finding on a PRD of your workspace.';
const NOT_A_MEMBER = 'Only a member of the workspace decides its findings.';

/** What each plan is called in the card's words, sent or not. */
function namesOf(plan: ApprovalPlan): { done: string; what: string; instead: string } {
  if (plan.kind === 'job') {
    const skill = `/omni:${plan.skill}`;
    return { done: `Queued ${skill} on a runner of the workspace, sent by you.`, what: `${skill} was not queued`, instead: `Run it from a terminal: ${plan.line}` };
  }
  if (plan.kind === 'proposal') {
    const kind = plan.knowledge === 'legal' ? 'Legal' : 'glossary';
    return { done: `Filed as a ${kind} proposal, for its owner to decide.`, what: `the ${kind} proposal was not filed`, instead: 'Propose it on the product\'s Knowledge tab.' };
  }
  return { done: 'Opened an issue on the kit\'s repository.', what: 'the issue was not opened', instead: 'Open it there with the card\'s text.' };
}

/** The database's refusal of a decision, in words. */
function refusedBy(no: DecisionRefusal, finding: DecidableFinding): { ok: false; kind: RewindRefusal; error: string } {
  if (no === 'missing') return refused(REFUSED[no], NO_FINDING);
  if (no === 'not-member') return refused(REFUSED[no], NOT_A_MEMBER);
  return refused(REFUSED[no], `This finding of PRD ${String(finding.prd)} was decided meanwhile: a decision is never rewritten.`);
}

export function decisionService(ports: DecisionPorts) {
  /** Sends what Approve sends for `finding`; never throws, and a failure is logged and said. */
  async function send(finding: DecidableFinding, plan: ApprovalPlan): Promise<FollowUp> {
    const names = namesOf(plan);
    let sent: Sent;
    try {
      if (plan.kind === 'job') sent = await ports.queue(finding.repository, plan.line);
      else if (plan.kind === 'proposal') sent = await ports.propose(finding.workspace, finding.repository, plan);
      else sent = await ports.openIssue(plan.title, plan.body);
    } catch (error) {
      ports.log(`rewind decide: ${names.what}: ${error instanceof Error ? error.message : String(error)}`);
      return { done: false, words: `Approved, but ${names.what}${plan.kind === 'issue' ? ' on the kit\'s repository' : ''}. ${names.instead}`, link: null };
    }
    if (sent.ok) return { done: true, words: names.done, link: sent.link };
    ports.log(`rewind decide: ${names.what}: ${sent.error}`);
    return { done: false, words: `Approved, but ${names.what}: ${sent.error} ${names.instead}`, link: null };
  }

  return {
    /** Approves or rejects the finding `id` for the member, once; Approve then sends its work. */
    async decide(id: string, verdict: 'approve' | 'reject', reason: string | null): Promise<Outcome<DecisionReply>> {
      const finding = await ports.finding(id);
      if (!finding) return refused('missing', NO_FINDING);
      if (finding.state !== 'proposed') return refused('decided', `This finding was already ${finding.state}: a decision is never rewritten.`);
      if (verdict === 'reject') {
        const no = await ports.reject(finding.workspace, id, reason);
        return no ? refusedBy(no, finding) : { ok: true, value: { state: 'rejected', followUp: null } };
      }
      const plan = approvalOf(finding);
      const leak = plan.kind === 'issue' ? leakOf(`${plan.title}\n${plan.body}`, finding.repository) : null;
      if (leak !== null) {
        return refused('unshareable', `This finding names ${leak}, so it cannot leave the workspace as an issue on the kit's repository. Reject it, or raise it there in your own words.`);
      }
      const no = await ports.approve(finding.workspace, id);
      if (no) return refusedBy(no, finding);
      return { ok: true, value: { state: 'approved', followUp: await send(finding, plan) } };
    },
  };
}

export type DecisionService = ReturnType<typeof decisionService>;
