// PRD 790: the pure decision a PR care round acts on. It turns a feature PR's care state (`state.mjs`,
// plus the command's `wave`) into the round's next actions, in the order the spec fixes: a conflict,
// then red CI, then each review thread, and always the status comment last. `/omni:pr-care` only
// carries them out.
//
// | mode          | when                                                           | actions               |
// | ------------- | -------------------------------------------------------------- | --------------------- |
// | `stop`        | the PR is merged or closed                                     | none                  |
// | `report-only` | a wave holds claims, or whether one does could not be read     | `status` only         |
// | `act`         | otherwise                                                      | the ordered list      |
//
// Actions: `restack` (a landing chain link: retarget the next landing's PR when GitHub did not,
// rebase its branch onto the default branch and every later landing's onto the one before; first,
// since it moves the base everything else reads), `merge-base` (`base`), `fix-ci` (`failed`: red, fixable and not stuck), `judge`
// (`thread`: no care reply yet), `mark-asked` (`thread`: a person had the last word after a care
// reply), `status`.
//
// A PR whose status comment says it `waits on <slug>#<pr>` (PRD 1118: its red comes from another
// repository's pull request still open) lists no `fix-ci` while that PR is open or cannot be read, and
// the round says what it waits on; once that PR merged, a red round lists one `rerun` of the failed
// checks instead; closed unmerged, it decides as without the line.
//
// A sub-PR's round (issue #1178, `decideSubPrRound`) is the one `/omni:wave` runs before it merges a
// sub-PR into the feature branch, where a reviewer bot may have reviewed it: its review threads only.
// The wave's own claims never hold it, and it lists no `restack`, `merge-base`, CI action or `status`
// (the wave resolves the conflict and writes the sub-PR's status comment, and a sub-PR's checks are
// never read). Its modes:
//
// | mode    | when                                                       | actions                    |
// | ------- | ---------------------------------------------------------- | -------------------------- |
// | `stop`  | the sub-PR is merged or closed                             | none                       |
// | `act`   | a thread has no care reply, or a person wrote after one    | `judge`, `mark-asked`      |
// | `hold`  | nothing left to act on, and a thread was left asked        | none; `held` names them    |
// | `clear` | nothing left to act on, and no thread is asked             | none: the merge gate next  |

import type { ChainLink } from './chain.ts';
import type { CareVerdict } from './marker.ts';
import type { CareChecks, CareState, ThreadNeed, WaitsOn } from './state.ts';

/** The pull request named by a `waits on` line, with its state as read from GitHub. */
export type Waiting = WaitsOn & { state: 'open' | 'merged' | 'closed' | 'unreadable' };

/** What a round reads: the care state, as far as it decides on it, and whether a wave holds claims. */
export type RoundState = {
  pr: Pick<CareState['pr'], 'state' | 'base'>;
  checks: CareChecks;
  mergeable: string;
  threads: ReadonlyArray<{ id: string; needs: ThreadNeed }>;
  wave?: { holdsClaims: boolean | null } | null;
  /** A PRD of several landings: the chain links to restack (`landingChain`). */
  chain?: readonly ChainLink[];
  /** The pull request the status comment says this one waits on, or none. */
  waitsOn?: Waiting | null;
};

export type RoundAction =
  | ({ kind: 'restack' } & ChainLink)
  | { kind: 'merge-base'; base: string }
  | { kind: 'fix-ci'; failed: CareChecks['failed'] }
  | { kind: 'rerun'; failed: CareChecks['failed'] }
  | { kind: 'judge'; thread: string }
  | { kind: 'mark-asked'; thread: string }
  | { kind: 'status' };

export type Round = { mode: 'stop' | 'report-only' | 'act'; actions: RoundAction[]; waitsOn?: string };

/** What a sub-PR's round reads: its state and its threads, each with its verdict. */
export type SubPrRoundState = {
  pr: Pick<CareState['pr'], 'state'>;
  threads: ReadonlyArray<{ id: string; needs: ThreadNeed; verdict: CareVerdict | null }>;
};

/** The actions of a sub-PR's round: thread actions only. */
export type SubPrAction = Extract<RoundAction, { kind: 'judge' | 'mark-asked' }>;

export type SubPrRound = { mode: 'stop' | 'act' | 'hold' | 'clear'; actions: SubPrAction[]; held?: string[] };

/** Whether the named pull request still holds this one: open, or unreadable. */
function holds(waiting: Waiting | null | undefined): boolean {
  return waiting?.state === 'open' || waiting?.state === 'unreadable';
}

/** The round's CI action: none, `fix-ci`, or one `rerun` once the PR it waited on has merged. */
function ciActions({ checks, waitsOn }: Pick<RoundState, 'checks' | 'waitsOn'>): RoundAction[] {
  if (checks.state !== 'red' || !checks.fixable || checks.stuck || holds(waitsOn)) return [];
  return [{ kind: waitsOn?.state === 'merged' ? 'rerun' : 'fix-ci', failed: checks.failed }];
}

/** One `judge` per thread without a care reply, one `mark-asked` per thread a person had the last word on. */
function threadActions(threads: RoundState['threads']): SubPrAction[] {
  return threads.flatMap((thread): SubPrAction[] => (thread.needs === null ? [] : [{ kind: thread.needs, thread: thread.id }]));
}

/** The round `/omni:wave` runs on a sub-PR before its merge gate: its threads, whatever else holds. */
export function decideSubPrRound(state: SubPrRoundState): SubPrRound {
  if (state.pr.state !== 'OPEN') return { mode: 'stop', actions: [] };
  const actions = threadActions(state.threads);
  if (actions.length > 0) return { mode: 'act', actions };
  const held = state.threads.filter((thread) => thread.verdict === 'asked').map((thread) => thread.id);
  return held.length > 0 ? { mode: 'hold', actions: [], held } : { mode: 'clear', actions: [] };
}

export function decideRound(state: RoundState): Round {
  if (state.pr.state !== 'OPEN') return { mode: 'stop', actions: [] };
  if (state.wave?.holdsClaims !== false) return { mode: 'report-only', actions: [{ kind: 'status' }] };

  const actions: RoundAction[] = (state.chain ?? []).map((link) => ({ kind: 'restack', ...link }));
  if (state.mergeable === 'CONFLICTING') actions.push({ kind: 'merge-base', base: state.pr.base });
  actions.push(...ciActions(state));
  actions.push(...threadActions(state.threads));
  actions.push({ kind: 'status' });
  const { waitsOn } = state;
  return waitsOn && holds(waitsOn) ? { mode: 'act', actions, waitsOn: `${waitsOn.slug}#${waitsOn.pr}` } : { mode: 'act', actions };
}
