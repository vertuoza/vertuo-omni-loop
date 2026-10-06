// The merge gate of a sub-PR (PRD 1089): `rules.subPr` of the areas a slice touches, applied to
// what GitHub says of its pull request, and the merge command to run when they all hold. Pure: the
// CLI (`omni flow check merge`) gathers the facts and hands them here.
//
// - The areas are those of the slice's territory and of the sub-PR's diff together, so a change
//   that reaches into an area the plan did not name still meets that area's rules.
// - `merge` picks the method (`squash` with no flow, today's); two methods on one slice refuse.
// - `requireChecks`: each check is green (a pass, a skip or a neutral end), named by the first area
//   that asks for it. `approval: person`: a person, never a bot, approved. `territory: block`: no
//   changed path outside the territory (`report`, the default, names them and merges). `maxOpen`:
//   no more of the area's sub-PRs open into the same base than the count.
// - The guards hold whatever the flow says: a sub-PR into the default branch, or one not open,
//   never merges.
import { covers } from '../inbox/territory.ts';
import type { AreaRules, ResolvedFlow, TerritoryFlow } from './resolve.ts';
import { resolveTerritory } from './resolve.ts';

export type CheckState = 'pass' | 'pending' | 'fail';

/** A sub-PR as the gate reads it. */
export type SubPr = {
  number: number;
  /** GitHub's state: `OPEN`, `CLOSED`, `MERGED`. */
  state: string;
  base: string;
  head: string;
  checks: { name: string; state: CheckState }[];
  /** Each person whose review stands as an approval. */
  approvedBy: string[];
  /** Every path its diff changes. */
  files: string[];
};

/** Another open sub-PR into the same base, with its slice's territory. */
export type OpenSubPr = { number: number; territory: string[] };

export type MergeVerdict = {
  ok: boolean;
  method: NonNullable<AreaRules['subPr']['merge']>;
  /** The command to run when `ok`, as argv; `null` otherwise. */
  command: string[] | null;
  areas: string[];
  /** Why it does not merge, each `<area>: <rule> — <why>`, or a guard's line. */
  reasons: string[];
  /** What merges anyway but a person should see. */
  reported: string[];
};

/** What the gate's rules read of one sub-PR: the facts, and the areas they meet. */
type Gate = {
  flow: ResolvedFlow;
  pr: SubPr;
  territory: readonly string[] | null;
  defaultBranch: string;
  open: readonly OpenSubPr[];
  /** Its changed paths, the loop's own ground left out. */
  files: string[];
  met: TerritoryFlow;
};

/** What the rules find: why it does not merge, and what merges anyway but a person should see. */
type Findings = { reasons: string[]; reported: string[] };

/** The first met area whose rules ask for something, `default` when none does. */
function firstAsking({ met }: Gate, asks: (rules: AreaRules) => boolean): string {
  return met.areas.find(({ rules }) => asks(rules))?.name ?? 'default';
}

/** The guards the flow cannot lift: never into the default branch, never a sub-PR not open. */
function guards({ pr, defaultBranch }: Gate, { reasons }: Findings): void {
  if (pr.base === defaultBranch) reasons.push(`#${pr.number} targets ${pr.base}, the default branch: a person merges there`);
  if (pr.state !== 'OPEN') reasons.push(`#${pr.number} is not open (${pr.state})`);
}

/** `merge`: two methods on one slice refuse. */
function mergeConflicts({ met }: Gate, { reasons }: Findings): void {
  if (met.conflicts.merge.length === 0) return;
  const named = met.conflicts.merge.map(({ area, method: m }) => `${area} ${m}`).join(', ');
  reasons.push(`${met.conflicts.merge.map(({ area }) => area).join(', ')}: merge — two merge methods on one slice (${named}): split the slice`);
}

/** Why the runs of one required check do not count as green, `null` when they do. */
function checkWhy(states: readonly CheckState[]): string | null {
  if (states.length === 0) return 'has not run';
  if (states.includes('fail')) return 'failed';
  return states.includes('pending') ? 'is pending' : null;
}

/** `requireChecks`: each check green, named by the first area that asks for it. */
function requiredChecks(gate: Gate, { reasons }: Findings): void {
  const { met, pr } = gate;
  for (const name of met.rules.subPr.requireChecks) {
    const why = checkWhy(pr.checks.filter((check) => check.name === name).map(({ state }) => state));
    if (why !== null) reasons.push(`${firstAsking(gate, (rules) => rules.subPr.requireChecks.includes(name))}: requireChecks ${name} — ${name} ${why} on #${pr.number}`);
  }
}

/** `approval: person`: a person, never a bot, approved. */
function approval(gate: Gate, { reasons }: Findings): void {
  const { met, pr } = gate;
  if (met.rules.subPr.approval !== 'person' || pr.approvedBy.length > 0) return;
  reasons.push(`${firstAsking(gate, (rules) => rules.subPr.approval === 'person')}: approval person — no person has approved #${pr.number}`);
}

/** `territory`: `block` refuses a changed path outside the territory, `report` names it and merges. */
function territoryRule(gate: Gate, findings: Findings): void {
  const { met, pr, territory, files } = gate;
  const block = met.rules.subPr.territory === 'block';
  const blocking = block ? `${firstAsking(gate, (rules) => rules.subPr.territory === 'block')}: territory block — ` : '';
  const into = block ? findings.reasons : findings.reported;
  if (territory === null) {
    into.push(
      block
        ? `${blocking}#${pr.number}'s head ${pr.head} is no slice of a plan here, so its territory is not known`
        : `#${pr.number}'s head ${pr.head} is no slice of a plan here: its diff was not compared with a territory`,
    );
    return;
  }
  for (const path of files.filter((file) => !covers(territory, file))) into.push(`${blocking}${path} is outside the slice's territory`);
}

/** `maxOpen`: no more of the area's sub-PRs open into the same base than the count. */
function maxOpen({ met, flow, open }: Gate, { reasons }: Findings): void {
  for (const { name, rules } of met.areas) {
    const max = rules.subPr.maxOpen;
    if (max === null) continue;
    const ofArea = open.filter((other) => resolveTerritory(flow, other.territory).areas.some((area) => area.name === name));
    if (ofArea.length > max) reasons.push(`${name}: maxOpen ${max} — ${ofArea.length} of its sub-PRs are open: ${ofArea.map(({ number }) => `#${number}`).join(', ')}`);
  }
}

/** The gate's rules, in the order their reasons are listed. */
const RULES: readonly ((gate: Gate, findings: Findings) => void)[] = [guards, mergeConflicts, requiredChecks, approval, territoryRule, maxOpen];

/**
 * Whether sub-PR `pr` merges: `territory` is its slice's (`null` when its head is no slice of a
 * plan), `open` every open sub-PR into the same base with its territory, `repo` the slug the
 * command names when the sub-PR lives in another repository. `ground` is the loop's own ground the
 * slice writes besides its territory (its PRD's outbox folder): a path under it is neither compared
 * with the territory nor met by an area, so a decision a slice records never changes its rules.
 */
export function mergeGate({
  flow,
  pr,
  territory,
  defaultBranch,
  open,
  repo = null,
  ground = [],
}: {
  flow: ResolvedFlow;
  pr: SubPr;
  territory: readonly string[] | null;
  defaultBranch: string;
  open: readonly OpenSubPr[];
  repo?: string | null;
  ground?: readonly string[];
}): MergeVerdict {
  const files = pr.files.filter((file) => !covers(ground, file));
  const met = resolveTerritory(flow, [...(territory ?? []), ...files]);
  const method = met.rules.subPr.merge ?? 'squash';
  const gate: Gate = { flow, pr, territory, defaultBranch, open, files, met };
  const findings: Findings = { reasons: [], reported: [] };
  for (const rule of RULES) rule(gate, findings);

  const ok = findings.reasons.length === 0;
  return {
    ok,
    method,
    command: ok ? ['gh', 'pr', 'merge', String(pr.number), `--${method}`, '--delete-branch', ...(repo === null ? [] : ['--repo', repo])] : null,
    areas: met.areas.map(({ name }) => name),
    ...findings,
  };
}

/** One entry of `gh pr view --json statusCheckRollup`: a check run or a commit status. */
export type RollupEntry = { __typename?: string | undefined; name?: string | undefined; context?: string | undefined; status?: string | undefined; conclusion?: string | null | undefined; state?: string | undefined };

const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const WORST: CheckState[] = ['fail', 'pending', 'pass'];

const WAITING = new Set(['PENDING', 'EXPECTED']);

/** A commit status's state. */
function statusState(state: string): CheckState {
  if (state === 'SUCCESS') return 'pass';
  return WAITING.has(state) ? 'pending' : 'fail';
}

/** A check run's state. */
function runState({ status, conclusion }: RollupEntry): CheckState {
  if (status !== 'COMPLETED') return 'pending';
  return PASSING.has(conclusion ?? '') ? 'pass' : 'fail';
}

/** One rollup entry's state. */
function entryState(entry: RollupEntry): CheckState {
  const isStatus = entry.__typename === 'StatusContext' || entry.context !== undefined;
  return isStatus ? statusState(entry.state ?? '') : runState(entry);
}

/** The rollup as one state per check name, the worst of its runs, in first-seen order. */
export function checkState(rollup: readonly RollupEntry[]): { name: string; state: CheckState }[] {
  const byName = new Map<string, CheckState>();
  for (const entry of rollup) {
    const name = entry.name ?? entry.context;
    if (name === undefined) continue;
    const state = entryState(entry);
    const before = byName.get(name);
    byName.set(name, before === undefined || WORST.indexOf(state) < WORST.indexOf(before) ? state : before);
  }
  return [...byName].map(([name, state]) => ({ name, state }));
}

/** One review of `gh pr view --json reviews`. */
export type Review = { author?: { login?: string | undefined } | null | undefined; state?: string | undefined };

const DECIDING = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);

/** Each person whose last deciding review approves, in first-seen order; a bot (`…[bot]`) is no person. */
export function personApproved(reviews: readonly Review[]): string[] {
  const last = new Map<string, string>();
  for (const { author, state = '' } of reviews) {
    const login = author?.login;
    if (login === undefined || login.endsWith('[bot]') || !DECIDING.has(state)) continue;
    last.set(login, state);
  }
  return [...last].filter(([, state]) => state === 'APPROVED').map(([login]) => login);
}
