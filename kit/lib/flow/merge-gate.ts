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
import type { AreaRules, ResolvedFlow } from './resolve.ts';
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

/**
 * Whether sub-PR `pr` merges: `territory` is its slice's (`null` when its head is no slice of a
 * plan), `open` every open sub-PR into the same base with its territory, `repo` the slug the
 * command names when the sub-PR lives in another repository.
 */
export function mergeGate({
  flow,
  pr,
  territory,
  defaultBranch,
  open,
  repo = null,
}: {
  flow: ResolvedFlow;
  pr: SubPr;
  territory: readonly string[] | null;
  defaultBranch: string;
  open: readonly OpenSubPr[];
  repo?: string | null;
}): MergeVerdict {
  const met = resolveTerritory(flow, [...(territory ?? []), ...pr.files]);
  const method = met.rules.subPr.merge ?? 'squash';
  const reasons: string[] = [];
  const reported: string[] = [];
  const firstAsking = (asks: (rules: AreaRules) => boolean) => met.areas.find(({ rules }) => asks(rules))?.name ?? 'default';

  if (pr.base === defaultBranch) reasons.push(`#${pr.number} targets ${pr.base}, the default branch: a person merges there`);
  if (pr.state !== 'OPEN') reasons.push(`#${pr.number} is not open (${pr.state})`);

  if (met.conflicts.merge.length > 0) {
    const named = met.conflicts.merge.map(({ area, method: m }) => `${area} ${m}`).join(', ');
    reasons.push(`${met.conflicts.merge.map(({ area }) => area).join(', ')}: merge — two merge methods on one slice (${named}): split the slice`);
  }

  for (const name of met.rules.subPr.requireChecks) {
    const states = pr.checks.filter((check) => check.name === name).map(({ state }) => state);
    const why = states.length === 0 ? 'has not run' : states.includes('fail') ? 'failed' : states.includes('pending') ? 'is pending' : null;
    if (why !== null) reasons.push(`${firstAsking((rules) => rules.subPr.requireChecks.includes(name))}: requireChecks ${name} — ${name} ${why} on #${pr.number}`);
  }

  if (met.rules.subPr.approval === 'person' && pr.approvedBy.length === 0) {
    reasons.push(`${firstAsking((rules) => rules.subPr.approval === 'person')}: approval person — no person has approved #${pr.number}`);
  }

  const block = met.rules.subPr.territory === 'block';
  const blocking = block ? `${firstAsking((rules) => rules.subPr.territory === 'block')}: territory block — ` : '';
  if (territory === null) {
    if (block) reasons.push(`${blocking}#${pr.number}'s head ${pr.head} is no slice of a plan here, so its territory is not known`);
    else reported.push(`#${pr.number}'s head ${pr.head} is no slice of a plan here: its diff was not compared with a territory`);
  } else {
    for (const path of pr.files.filter((file) => !covers(territory, file))) {
      (block ? reasons : reported).push(`${blocking}${path} is outside the slice's territory`);
    }
  }

  for (const { name, rules } of met.areas) {
    const max = rules.subPr.maxOpen;
    if (max === null) continue;
    const ofArea = open.filter((other) => resolveTerritory(flow, other.territory).areas.some((area) => area.name === name));
    if (ofArea.length > max) reasons.push(`${name}: maxOpen ${max} — ${ofArea.length} of its sub-PRs are open: ${ofArea.map(({ number }) => `#${number}`).join(', ')}`);
  }

  const ok = reasons.length === 0;
  return {
    ok,
    method,
    command: ok ? ['gh', 'pr', 'merge', String(pr.number), `--${method}`, '--delete-branch', ...(repo === null ? [] : ['--repo', repo])] : null,
    areas: met.areas.map(({ name }) => name),
    reasons,
    reported,
  };
}

/** One entry of `gh pr view --json statusCheckRollup`: a check run or a commit status. */
export type RollupEntry = { __typename?: string | undefined; name?: string | undefined; context?: string | undefined; status?: string | undefined; conclusion?: string | null | undefined; state?: string | undefined };

const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);
const WORST: CheckState[] = ['fail', 'pending', 'pass'];

/** One rollup entry's state. */
function entryState(entry: RollupEntry): CheckState {
  if (entry.__typename === 'StatusContext' || entry.context !== undefined) {
    const state = entry.state ?? '';
    return state === 'SUCCESS' ? 'pass' : state === 'PENDING' || state === 'EXPECTED' ? 'pending' : 'fail';
  }
  if (entry.status !== 'COMPLETED') return 'pending';
  return PASSING.has(entry.conclusion ?? '') ? 'pass' : 'fail';
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
