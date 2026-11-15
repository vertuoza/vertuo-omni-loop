// PRD 2898, s1: the ready rule — whether a feature PR may be marked ready, from facts read at its
// latest commit. Five checks, each `pass`, `fail`, `not finished` (its evidence is not there yet) or
// `not judged` (its evidence could not be read), each with why:
//
// 1. CI green on the latest commit: every check run of that commit finished `success`, the rule's own
//    check left out. A run that skipped or was cancelled is not green.
// 2. The full tests and lint ran: each CI job `ready.full` names succeeded on that commit.
// 3. Every acceptance criterion has its proof: each `AC-<n>` of the spec has a passing proof of its own
//    kind in the acceptance report of that commit.
// 4. No test was loosened (`loosening.ts`), unless an agreed item excuses the path.
// 5. The change stayed in its area: every file of the diff sits under a slice's territory, the PRD's
//    folder or a generated path, unless an agreed or adopted item excuses the path.
//
// The verdict is ready only when all five pass: one `not finished` or `not judged` keeps it not
// finished, never ready (BL-GATE-1). Pure: no network, no model. `omni ready` and the App's
// `omni / ready` read the facts their own way and run this same rule, so they never disagree.
import { READY_LOOSENING_GROUND } from '../config.ts';
import type { OutboxItemId } from '../ids.ts';
import { breaches } from '../inbox/territory.ts';
import type { Criterion, ParsedCriteria } from './criteria.ts';
import { excuse } from './excuses.ts';
import type { ExcuseItem, ExcusingCheck } from './excuses.ts';
import { loosenings } from './loosening.ts';
import type { DiffFile, LooseningGround } from './loosening.ts';
import { ACCEPTANCE_CHECK_NAME } from './report.ts';
import type { AcceptanceReport } from './report.ts';

/** The check the App posts with this rule's verdict: never counted in check 1. */
export const READY_CHECK_NAME = 'omni / ready';

/** The five checks, in order, each with its title. */
const CHECKS = [
  { id: 'ci', title: 'CI green on the latest commit' },
  { id: 'full', title: 'The full tests and lint ran' },
  { id: 'acceptance', title: 'Every acceptance criterion has its proof' },
  { id: 'loosening', title: 'No test was loosened' },
  { id: 'area', title: 'The change stayed in its area' },
] as const;

/** A check's id. */
type CheckId = (typeof CHECKS)[number]['id'];

/** How a check ended. Only `pass` passes. */
type CheckState = 'pass' | 'fail' | 'not finished' | 'not judged';

/** A fact as read: its value, or why it could not be read. */
type Readable<T> = { ok: true; value: T } | { ok: false; why: string };

/** One check run of the head commit, as GitHub reports it. */
export type CheckRun = {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  /** `success`, `failure`, `skipped`, `cancelled`…, or null while it runs. */
  conclusion: string | null;
  url?: string | null;
};

/** What a feature PR's area is: the plan's territories, the PRD's folders (its inbox or shipped folder
 * and its outbox) and the generated paths, each a path prefix. */
type Area = { territories: readonly string[]; prdFolders: readonly string[]; generated: readonly string[] };

/** Everything the rule reads, read at the feature PR's latest commit. */
export type ReadyFacts = {
  /** The latest commit's sha. */
  head: string;
  runs: Readable<readonly CheckRun[]>;
  /** `ready.full`: the CI jobs that run the whole suite. */
  full: readonly string[];
  /** The spec's criteria at the head. */
  criteria: Readable<ParsedCriteria>;
  /** The spec's criteria on the default branch; none when the spec is not there yet. */
  baseCriteria: Readable<readonly Criterion[]>;
  /** The acceptance report of the head commit; null while there is none. */
  report: Readable<AcceptanceReport | null>;
  /** The diff against the default branch, file by file. */
  diff: Readable<readonly DiffFile[]>;
  area: Readable<Area>;
  /** The PRD's outbox items, settled and open (`excuseItems`). */
  ledger: Readable<readonly ExcuseItem[]>;
  /** Where a loosening is read; the kit's own when left out. */
  ground?: LooseningGround;
  /** A link to each check's evidence, when the reader has one. */
  evidence?: Partial<Record<CheckId, string>>;
};

/** One check's result. `excused` names each path an item excused, and the item. */
type CheckResult = {
  id: CheckId;
  title: string;
  state: CheckState;
  why: string;
  evidence: string | null;
  excused: { path: string; item: OutboxItemId }[];
};

/** The verdict: ready only on five passes; `not ready` when a check fails, else `not finished`. */
type ReadyVerdict = { ready: boolean; state: 'ready' | 'not ready' | 'not finished'; passed: number; headline: string; checks: CheckResult[] };

/** A check's outcome before its title and evidence are put on it. */
type Outcome = { state: CheckState; why: string; excused?: { path: string; item: OutboxItemId }[] };

const pass = (why: string, excused: Outcome['excused'] = []): Outcome => ({ state: 'pass', why, excused });
const fail = (why: string): Outcome => ({ state: 'fail', why });
const waiting = (why: string): Outcome => ({ state: 'not finished', why });
const unjudged = (why: string): Outcome => ({ state: 'not judged', why });

const LISTED = 3;

/** The first few of `items`, joined, and how many more there are. */
function listed(items: readonly string[], separator: string): string {
  const more = items.length - LISTED;
  return [...items.slice(0, LISTED), ...(more > 0 ? [`and ${String(more)} more`] : [])].join(separator);
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

/** Check 1: every check run of the head commit, the rule's own left out, finished success. */
function ciCheck(runs: Readable<readonly CheckRun[]>): Outcome {
  if (!runs.ok) return unjudged(runs.why);
  const counted = runs.value.filter((run) => run.name !== READY_CHECK_NAME);
  if (counted.length === 0) return waiting('no check has run on the latest commit yet');
  const red = counted.filter((run) => run.status === 'completed' && run.conclusion !== 'success');
  if (red.length > 0) return fail(`not green: ${red.map((run) => `${run.name} (${run.conclusion ?? 'no conclusion'})`).join(', ')}`);
  const going = counted.filter((run) => run.status !== 'completed');
  if (going.length > 0) return waiting(`still running: ${going.map((run) => run.name).join(', ')}`);
  return pass(`${plural(counted.length, 'check')} green`);
}

/** The runs of one CI job: its name, or a leg of its matrix (`test (1)`). */
const runsOf = (runs: readonly CheckRun[], job: string) => runs.filter((run) => run.name === job || run.name.startsWith(`${job} (`));

/** Check 2: each job `ready.full` names succeeded. */
function fullCheck(runs: Readable<readonly CheckRun[]>, full: readonly string[]): Outcome {
  if (full.length === 0) return unjudged('ready.full names no CI job');
  if (!runs.ok) return unjudged(runs.why);
  const jobs = full.map((job) => ({ job, runs: runsOf(runs.value, job) }));
  const red = jobs.flatMap(({ job, runs: legs }) => legs.filter((run) => run.status === 'completed' && run.conclusion !== 'success').map((run) => `${job} did not succeed (${run.conclusion ?? 'no conclusion'})`));
  if (red.length > 0) return fail(red.join('; '));
  const missing = jobs.filter(({ runs: legs }) => legs.length === 0).map(({ job }) => `${job} has not run on the latest commit yet`);
  if (missing.length > 0) return waiting(missing.join('; '));
  const going = jobs.filter(({ runs: legs }) => legs.some((run) => run.status !== 'completed')).map(({ job }) => job);
  if (going.length > 0) return waiting(`still running: ${going.join(', ')}`);
  return pass(`${full.join(' and ')} succeeded`);
}

/** How one criterion stands in the report: proven, waiting (with why), or failing (with why). */
function proofOf(criterion: Criterion, report: AcceptanceReport): { state: 'proven' } | { state: 'waiting' | 'failing'; why: string } {
  const name = `AC-${String(criterion.number)}`;
  const all = report.results.filter((result) => result.ac === criterion.number);
  const own = all.filter((result) => result.kind === criterion.kind);
  if (own.some((result) => result.state === 'failed')) return { state: 'failing', why: `${name} failed` };
  if (own.some((result) => result.state === 'passed')) return { state: 'proven' };
  const pending = own.find((result) => result.state === 'pending');
  if (pending) return { state: 'waiting', why: pending.why === undefined ? `${name} is still waiting` : `${name}: ${pending.why}` };
  if (own.length > 0) return { state: 'failing', why: `${name} was skipped` };
  const other = all[0];
  if (other) return { state: 'failing', why: `${name} is ${criterion.kind}, proven only by a ${other.kind} run` };
  return { state: 'failing', why: `${name} has no proof on this commit` };
}

/** Whether two shas name the same commit, one perhaps shortened. */
const sameCommit = (a: string, b: string) => a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a));

/** Why check 3 has no report to read yet, from the acceptance run's state. */
function noReport(runs: Readable<readonly CheckRun[]>): Outcome {
  const run = runs.ok ? runs.value.find((candidate) => candidate.name === ACCEPTANCE_CHECK_NAME) : undefined;
  if (run === undefined) return waiting('no acceptance report on the latest commit yet');
  if (run.status !== 'completed') return waiting('the acceptance run is still going');
  return unjudged('the acceptance run finished with no report');
}

/** Check 3, once the spec reads well and a report of the head commit is there. */
function proofsCheck(criteria: readonly Criterion[], report: AcceptanceReport): Outcome {
  const proofs = criteria.map((criterion) => proofOf(criterion, report));
  const failing = proofs.flatMap((proof) => (proof.state === 'failing' ? [proof.why] : []));
  const pending = proofs.flatMap((proof) => (proof.state === 'waiting' ? [proof.why] : []));
  if (failing.length > 0) return fail(listed([...failing, ...pending], '; '));
  if (pending.length > 0) return waiting(listed(pending, '; '));
  const count = String(criteria.length);
  return pass(`${count} of ${count} ${criteria.length === 1 ? 'criterion' : 'criteria'} proven`);
}

/** Check 3: each criterion of the spec has a passing proof of its kind on the head commit. */
function acceptanceCheck(facts: ReadyFacts): Outcome {
  const { criteria, report } = facts;
  if (!criteria.ok) return unjudged(criteria.why);
  if (criteria.value.problems.length > 0) return fail(`the spec's criteria are malformed: ${listed(criteria.value.problems.map(({ problem }) => problem), '; ')}`);
  if (criteria.value.criteria.length === 0) return fail('the spec has no criterion written ### AC-<n> · <kind>');
  if (!report.ok) return unjudged(report.why);
  if (report.value === null) return noReport(facts.runs);
  if (!sameCommit(report.value.commit, facts.head)) {
    return waiting(`the acceptance report is of ${report.value.commit.slice(0, 8)}, not the latest commit ${facts.head.slice(0, 8)}`);
  }
  return proofsCheck(criteria.value.criteria, report.value);
}

/** A finding on a path, excused or not. */
type Found = { path: string; text: string };

/** The findings no item excuses, with why the item naming one does not, and the excused ones. */
function excuseAll(found: readonly Found[], ledger: Readable<readonly ExcuseItem[]>, check: ExcusingCheck): Outcome | { open: string[]; excused: { path: string; item: OutboxItemId }[] } {
  if (found.length === 0) return { open: [], excused: [] };
  if (!ledger.ok) return unjudged(`the outbox could not be read: ${ledger.why}`);
  const open: string[] = [];
  const excused: { path: string; item: OutboxItemId }[] = [];
  for (const { path, text } of found) {
    const read = excuse(path, ledger.value, check);
    if (read.excused) excused.push({ path, item: read.item });
    else open.push(read.note === null ? text : `${text} (${read.note})`);
  }
  return { open, excused };
}

/** The `excused by` part of a pass. */
const excusedText = (excused: readonly { path: string; item: OutboxItemId }[]) => listed(excused.map(({ path, item }) => `${path} excused by ${item}`), '; ');

/** What check 4 reads a diff with: the spec at both ends (null when either is unread), the ground and
 * the generated paths, which it never reads. */
function looseningOptions(facts: ReadyFacts): Parameters<typeof loosenings>[1] {
  const ends = facts.criteria.ok && facts.baseCriteria.ok ? { base: facts.baseCriteria.value, head: facts.criteria.value.criteria } : null;
  return { ground: facts.ground ?? READY_LOOSENING_GROUND, criteria: ends, generated: facts.area.ok ? facts.area.value.generated : [] };
}

/** Check 4: no test was loosened, unless an agreed item names the path. */
function looseningCheck(facts: ReadyFacts): Outcome {
  if (!facts.diff.ok) return unjudged(facts.diff.why);
  const read = loosenings(facts.diff.value, looseningOptions(facts));
  const judged = excuseAll(read.findings.map(({ path, what }) => ({ path, text: `${path}: ${what}` })), facts.ledger, 'loosening');
  if ('state' in judged) return judged;
  if (judged.open.length > 0) return fail(listed(judged.open, '; '));
  if (read.unjudged.length > 0) return unjudged(listed(read.unjudged, '; '));
  return pass(judged.excused.length === 0 ? 'no test was loosened' : excusedText(judged.excused), judged.excused);
}

/** Check 5: every file of the diff sits in its area, unless an agreed or adopted item names the path. */
function areaCheck(facts: ReadyFacts): Outcome {
  if (!facts.diff.ok) return unjudged(facts.diff.why);
  if (!facts.area.ok) return unjudged(facts.area.why);
  const { territories, prdFolders, generated } = facts.area.value;
  const paths = [...new Set(facts.diff.value.flatMap((file) => [file.previousPath, file.path].filter((path) => path !== undefined)))];
  const outside = breaches(paths, [...territories, ...prdFolders, ...generated]);
  const judged = excuseAll(outside.map((path) => ({ path, text: path })), facts.ledger, 'area');
  if ('state' in judged) return judged;
  if (judged.open.length > 0) return fail(`outside every territory: ${listed(judged.open, ', ')}`);
  const inArea = 'every file sits in its area';
  return pass(judged.excused.length === 0 ? inArea : `${inArea}; ${excusedText(judged.excused)}`, judged.excused);
}

/** Each check's outcome, by id. */
function outcomes(facts: ReadyFacts): Record<CheckId, Outcome> {
  return {
    ci: ciCheck(facts.runs),
    full: fullCheck(facts.runs, facts.full),
    acceptance: acceptanceCheck(facts),
    loosening: looseningCheck(facts),
    area: areaCheck(facts),
  };
}

/** The headline of a verdict: `Ready for review · 5 of 5`, or the count and the first check that did not pass. */
function headline(state: ReadyVerdict['state'], passed: number, checks: readonly CheckResult[]): string {
  if (state === 'ready') return `Ready for review · ${String(passed)} of ${String(checks.length)}`;
  const first = checks.find((check) => check.state === 'fail') ?? checks.find((check) => check.state !== 'pass');
  const label = state === 'not ready' ? 'Not ready' : 'Not finished';
  return `${label} · ${String(passed)} of ${String(checks.length)} · ${first?.title ?? ''}: ${first?.state ?? ''}`;
}

/** The ready rule's verdict on `facts`. */
export function readyVerdict(facts: ReadyFacts): ReadyVerdict {
  const read = outcomes(facts);
  const checks = CHECKS.map(({ id, title }): CheckResult => {
    const { state, why, excused = [] } = read[id];
    return { id, title, state, why, evidence: facts.evidence?.[id] ?? null, excused };
  });
  const passed = checks.filter((check) => check.state === 'pass').length;
  const state = passed === checks.length ? 'ready' : checks.some((check) => check.state === 'fail') ? 'not ready' : 'not finished';
  return { ready: state === 'ready', state, passed, headline: headline(state, passed, checks), checks };
}
