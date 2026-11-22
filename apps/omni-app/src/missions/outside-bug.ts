// The Engineer's outside bugs (PRD omni-loop-21 s11, spec section 6): a failure the Reviewer, QA or a repair names outside the
// mission's PRDs gets the Engineer's bug fix on the mission branch. Pure, over what one run read: the jobs that named a bug, the bug-fix
// jobs the mission sent and their fixes' landing. No database, no GitHub, no clock: ./repair-run.ts › readOutsideBugs reads and lands,
// these decide, and the run sends what `outsidePicks` names.
//
//   naming       a Reviewer, QA or repair job that ended done names each bug it saw outside the mission's PRDs on one line of its log,
//                `omni outside-bug: #<issue> on <owner/repo>: <one sentence>`, its issue filed first; five a job at most, the first line
//                of a bug kept. A line naming one of the mission's own PRDs, holding a token or more than one sentence is not read
//   the job      `/omni:bug-fix #<issue> --base <mission branch>`, keyed `mission:<id>:bug:<issue>:run:<k>` (the key shape the
//                database already takes, PRD 3088), sent to the mission's own repository, one bug at a time, in the order they were
//                named. A bug on another repository, or a mission with no branch of its own, is listed for landing, never fixed
//   its end      read as the bug team reads a bug fix's end (./bug-team.ts › bugEndOf):
//                  pr-opened         its pull request joins the mission branch through the gate a repair's fix joins by (green checks,
//                                    not a draft, into the mission branch: ./repair.ts › judgeFix), never the default branch
//                                    (N-PRODUCT-15); a fix that cannot join is listed, saying why
//                  already-fixed     fixed, nothing to join
//                  needs-brainstorm, the fix stopped at the bug fix's boundary: listed for landing with its `/omni:brainstorm` line
//                  need-human
//                  not-a-bug, cancelled   listed, saying why
//                  stuck, blocked, a failure, unreadable   one try spent: sent again, the 3rd listed with what was tried
//                  lost              sent again, no try spent; six jobs at most
//   landing      every outside bug, fixed or listed, in the order named: what the mission pull request's Re-test closes on (s12)
//   events       bug-taken (supervisor) once a job is sent, job-ended (engineer) once it ended, bug-fixed once its fix joined, bug-asked
//                once it is listed: one sentence and one link each, keyed by the bug-fix job, so a replay records none twice
import { isOneSentence } from 'omni-loop/kit/lib/repair/retro.ts';
import { holdsToken } from 'omni-loop/kit/lib/repair/sensitive.ts';
import { IssueNumberSchema, type IssueNumber, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { atWork, BUG_TRIES, bugEndOf, latestOf, triedOf, type BugJob } from './bug-team.ts';
import type { FixLanding } from './repair.ts';
import type { NewEvent } from './supervisor.ts';

/** Who named an outside bug: the Reviewer, QA or a repair. */
export type Namer = 'reviewer' | 'qa' | 'repair';

/** A job that ended done and may name outside bugs: who it is, the PRD it worked on (none for a stuck repair), its id and its log. */
export type Naming = { by: Namer; prd: PrdNumber | null; job: string; log: string | null };

/** A bug named outside the mission's PRDs: its repository, its issue, the sentence that named it, who named it and the job it was named in. */
export type OutsideBug = { repo: string; issue: IssueNumber; sentence: string; by: Namer; prd: PrdNumber | null; namedIn: string };

/** The bugs one job names at most. */
const OUTSIDE_PER_JOB = 5;
/** The bug-fix jobs one outside bug is sent at most, lost ones counted: a lost job spends no try, so this bounds the loop. */
export const OUTSIDE_JOBS = BUG_TRIES * 2;

const PREFIX = 'omni outside-bug: ';
/** The time stamp a runner's log puts before a line. */
const STAMP = /^\d{2}:\d{2}:\d{2} /;
const LINE = /^omni outside-bug: #([1-9][0-9]*) on ([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+): (.+)$/;

/** The line a job writes for one outside bug, the one `outsideLinesOf` reads. */
export const outsideBugLine = (bug: { repo: string; issue: IssueNumber; sentence: string }): string => `${PREFIX}#${String(bug.issue)} on ${bug.repo}: ${bug.sentence}`;

/** The outside bugs a job's log names, in order, each once, five at most; a line that does not read whole is skipped. */
export function outsideLinesOf(log: string | null): { repo: string; issue: IssueNumber; sentence: string }[] {
  const found: { repo: string; issue: IssueNumber; sentence: string }[] = [];
  for (const raw of (log ?? '').split('\n')) {
    const match = LINE.exec(raw.trim().replace(STAMP, ''));
    const issue = IssueNumberSchema.safeParse(Number(match?.[1]));
    const repo = match?.[2];
    const sentence = match?.[3]?.trim();
    if (!issue.success || repo === undefined || sentence === undefined || !isOneSentence(sentence) || holdsToken(sentence)) continue;
    if (found.some((one) => one.repo === repo && one.issue === issue.data)) continue;
    found.push({ repo, issue: issue.data, sentence });
    if (found.length === OUTSIDE_PER_JOB) break;
  }
  return found;
}

/** `acme/widgets#12`: a bug as the room and the mission pull request name it. */
const bugName = ({ repo, issue }: { repo: string; issue: IssueNumber }): string => `${repo}#${String(issue)}`;

/**
 * The outside bugs the mission's jobs named, in the order the jobs are given, each bug once (its first naming kept): none naming one of
 * the mission's own PRDs on its repository (`repo`, `scope` its PRD numbers), which is that PRD's work, not an outside bug.
 */
export function namedOutside(namings: readonly Naming[], { repo, scope }: { repo: string; scope: readonly number[] }): OutsideBug[] {
  const bugs: OutsideBug[] = [];
  for (const naming of namings) {
    for (const line of outsideLinesOf(naming.log)) {
      if (line.repo === repo && scope.includes(line.issue)) continue;
      if (bugs.some((one) => one.repo === line.repo && one.issue === line.issue)) continue;
      bugs.push({ ...line, by: naming.by, prd: naming.prd, namedIn: naming.job });
    }
  }
  return bugs;
}

/** The Engineer's line for an outside bug: its issue, fixed into the mission branch, never the default branch. */
export const outsideFixLine = (issue: IssueNumber, branch: string): string => `/omni:bug-fix #${String(issue)} --base ${branch}`;

/** The line a person runs to design a bug that crossed the bug fix's boundary: the sentence that named it, and the bug. */
export const brainstormLine = (bug: OutsideBug): string => `/omni:brainstorm ${bug.sentence.replace(/[.!?]+$/, '')} (${bugName(bug)})`;

/** Where an outside bug stands: its job to send, at work, its fix joining, fixed, or listed for the person at landing. */
export type OutsideState =
  | { state: 'send'; k: number; line: string; tries: number }
  | { state: 'fixing'; job: string }
  | { state: 'joining'; job: string; pr: PrNumber; lacks: readonly string[] }
  | { state: 'fixed'; job: string; pr: PrNumber | null }
  | { state: 'listed'; job: string | null; why: string; brainstorm: string | null };

/** What a run read for the outside bugs: the mission's repository and branch, its bug-fix jobs, and their fixes' landing. */
export type OutsideView = {
  /** The repository the mission's jobs run in. */
  repo: string;
  /** The mission branch of that repository; null at `with-you`, or before it is cut. */
  branch: string | null;
  jobs: readonly BugJob[];
  /** By bug-fix job: its fix pull request's landing on the mission branch. */
  landings: ReadonlyMap<string, FixLanding>;
};

/** Why a fix that stopped asked is listed, and whether it crossed the boundary (then its `/omni:brainstorm` line goes with it). */
const ASKED: Readonly<Record<'need-human' | 'needs-brainstorm' | 'not-a-bug' | 'cancelled', { why: string; boundary: boolean }>> = {
  'needs-brainstorm': { why: 'its fix is more than a bug fix', boundary: true },
  'need-human': { why: 'its fix needs a decision a bug fix does not take', boundary: true },
  'not-a-bug': { why: 'its bug fix says it is not a behaviour bug', boundary: false },
  cancelled: { why: 'a person stopped its bug fix', boundary: false },
};

/** The next job of a bug once its last ended with a try left, or listed once its tries or its jobs are spent. */
function again(bug: OutsideBug, view: OutsideView & { branch: string }, last: BugJob | undefined): OutsideState {
  const tried = triedOf(view.jobs, bug.issue);
  const k = (last?.k ?? 0) + 1;
  if (tried.length >= BUG_TRIES) return { state: 'listed', job: last?.job ?? null, why: `its bug fix ended ${tried.slice(-BUG_TRIES).join(', ')} in ${String(BUG_TRIES)} tries`, brainstorm: null };
  if (k > OUTSIDE_JOBS) return { state: 'listed', job: last?.job ?? null, why: `its bug fix was sent ${String(OUTSIDE_JOBS)} times without an end`, brainstorm: null };
  return { state: 'send', k, line: outsideFixLine(bug.issue, view.branch), tries: tried.length };
}

/** Where an opened fix stands: joined (fixed), joining, or listed when it cannot join. */
function joiningOf(job: BugJob, pr: PrNumber, landing: FixLanding | undefined): OutsideState {
  if (landing?.state === 'landed') return { state: 'fixed', job: job.job, pr };
  if (landing?.state === 'refused') return { state: 'listed', job: job.job, why: `its fix #${String(pr)} cannot join the mission branch: ${landing.why}`, brainstorm: null };
  return { state: 'joining', job: job.job, pr, lacks: landing?.state === 'waits' ? landing.lacks : [] };
}

/** Where one outside bug stands, from its jobs and their fixes' landing. */
export function outsideStateOf(bug: OutsideBug, view: OutsideView): OutsideState {
  if (bug.repo !== view.repo) return { state: 'listed', job: null, why: `the mission's Engineer works in ${view.repo} only`, brainstorm: null };
  const { branch } = view;
  if (branch === null) return { state: 'listed', job: null, why: 'the mission has no branch of its own to fix it on', brainstorm: null };
  const last = latestOf(view.jobs, bug.issue);
  const attempt = last?.attempts.at(-1);
  if (last === undefined || attempt === undefined) return again(bug, { ...view, branch }, last);
  if (atWork(last)) return { state: 'fixing', job: last.job };
  const end = bugEndOf(attempt);
  switch (end.end) {
    case 'pr-opened':
      return end.pr === null ? { state: 'listed', job: last.job, why: 'its bug fix opened no pull request it names', brainstorm: null } : joiningOf(last, end.pr, view.landings.get(last.job));
    case 'already-fixed':
      return { state: 'fixed', job: last.job, pr: end.pr };
    case 'asked': {
      const asked = ASKED[end.word];
      return { state: 'listed', job: last.job, why: asked.why, brainstorm: asked.boundary ? brainstormLine(bug) : null };
    }
    case 'lost':
    case 'spent':
      return again(bug, { ...view, branch }, last);
  }
}

/** One outside bug and where it stands. */
export type Outside = OutsideBug & OutsideState;

/** Every outside bug and where it stands, in the order named. */
export const outsideStates = (bugs: readonly OutsideBug[], view: OutsideView): Outside[] => bugs.map((bug) => ({ ...bug, ...outsideStateOf(bug, view) }));

/** The bugs whose job this run sends: the first to send, while no other is being fixed or joining (one at a time). */
export function outsidePicks(states: readonly Outside[]): (Outside & { state: 'send' })[] {
  if (states.some((one) => one.state === 'fixing' || one.state === 'joining')) return [];
  const first = states.find((one): one is Outside & { state: 'send' } => one.state === 'send');
  return first === undefined ? [] : [first];
}

// ── The events ──────────────────────────────────────────────────────────────────

const NAMER: Readonly<Record<Namer, string>> = { reviewer: 'the Reviewer', qa: 'QA', repair: 'a repair' };

const issueLink = (bug: OutsideBug): string => `https://github.com/${bug.repo}/issues/${String(bug.issue)}`;
const pullLink = (bug: OutsideBug, pr: PrNumber): string => `https://github.com/${bug.repo}/pull/${String(pr)}`;

/** An event of an outside bug: on no PRD, keyed by its bug-fix job. */
const said = (kind: NewEvent['kind'], role: NewEvent['role'], job: string, link: string, sentence: string): NewEvent => ({ kind, role, prd: null, job, link, sentence });

/** What the room is told once a bug's job was sent (`job` its id): the bug, who named it, the line and the try. */
export const takenEvent = (bug: Outside & { state: 'send' }, job: string): NewEvent =>
  said('bug-taken', 'supervisor', job, issueLink(bug), `${NAMER[bug.by]} named ${bugName(bug)} outside the mission's PRDs: sent ${bug.line}, try ${String(bug.tries + 1)} of ${String(BUG_TRIES)}.`);

/** What the room is told of one bug once its latest job ended, keyed by that job: none while it is sent or at work. */
function eventsOfOne(bug: Outside): NewEvent[] {
  const name = bugName(bug);
  switch (bug.state) {
    case 'joining':
      return [said('job-ended', 'engineer', bug.job, pullLink(bug, bug.pr), `${name}: fix PR #${String(bug.pr)} is open into the mission branch; it joins once green.`)];
    case 'fixed': {
      if (bug.pr === null) return [said('job-ended', 'engineer', bug.job, issueLink(bug), `${name} is already fixed.`)];
      const link = pullLink(bug, bug.pr);
      return [said('job-ended', 'engineer', bug.job, link, `${name}: fix PR #${String(bug.pr)} joined the mission branch.`), said('bug-fixed', 'supervisor', bug.job, link, `${name} is fixed on the mission branch by #${String(bug.pr)}.`)];
    }
    case 'listed':
      // A bug listed before any job was sent (another repository, no mission branch) has no job to key its event by: landing lists it.
      return bug.job === null ? [] : [said('bug-asked', 'supervisor', bug.job, issueLink(bug), `${name}: its bug fix ended, and the bug is listed for the person: ${bug.why}.`)];
    case 'send':
    case 'fixing':
      return [];
  }
}

/** The events a run may record of its outside bugs (the caller drops those already recorded): each end, each fix joined, each bug listed. */
export const outsideEvents = (states: readonly Outside[]): NewEvent[] => states.flatMap(eventsOfOne);

// ── Landing ─────────────────────────────────────────────────────────────────────

/** One outside bug as the mission pull request's Re-test closes on it: fixed, being fixed, or listed with why (and its brainstorm line). */
function outsideLandingLine(bug: Outside): string {
  const named = `${bugName(bug)} (named by ${NAMER[bug.by]}): ${bug.sentence.replace(/[.!?]+$/, '')}`;
  switch (bug.state) {
    case 'fixed':
      return bug.pr === null ? `Fixed already · ${named}` : `Fixed by #${String(bug.pr)} · ${named}`;
    case 'listed':
      return `Not fixed, ${bug.why} · ${named}${bug.brainstorm === null ? '' : ` · design it first: \`${bug.brainstorm}\``}`;
    case 'joining':
      return `Fix #${String(bug.pr)} not joined yet · ${named}`;
    case 'send':
    case 'fixing':
      return `Being fixed · ${named}`;
  }
}

/** The outside bugs the mission pull request lists, fixed or not, in the order named: one line each. */
export const outsideLanding = (states: readonly Outside[]): string[] => states.map(outsideLandingLine);
