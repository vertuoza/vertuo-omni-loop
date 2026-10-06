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

import type { ChainLink } from './chain.ts';
import type { CareChecks, CareState, ThreadNeed } from './state.ts';

/** What a round reads: the care state, as far as it decides on it, and whether a wave holds claims. */
export type RoundState = {
  pr: Pick<CareState['pr'], 'state' | 'base'>;
  checks: CareChecks;
  mergeable: string;
  threads: ReadonlyArray<{ id: string; needs: ThreadNeed }>;
  wave?: { holdsClaims: boolean | null } | null;
  /** A PRD of several landings: the chain links to restack (`landingChain`). */
  chain?: readonly ChainLink[];
};

export type RoundAction =
  | ({ kind: 'restack' } & ChainLink)
  | { kind: 'merge-base'; base: string }
  | { kind: 'fix-ci'; failed: CareChecks['failed'] }
  | { kind: 'judge'; thread: string }
  | { kind: 'mark-asked'; thread: string }
  | { kind: 'status' };

export type Round = { mode: 'stop' | 'report-only' | 'act'; actions: RoundAction[] };

export function decideRound(state: RoundState): Round {
  if (state.pr.state !== 'OPEN') return { mode: 'stop', actions: [] };
  if (state.wave?.holdsClaims !== false) return { mode: 'report-only', actions: [{ kind: 'status' }] };

  const actions: RoundAction[] = (state.chain ?? []).map((link) => ({ kind: 'restack', ...link }));
  if (state.mergeable === 'CONFLICTING') actions.push({ kind: 'merge-base', base: state.pr.base });
  const { checks } = state;
  if (checks.state === 'red' && checks.fixable && !checks.stuck) actions.push({ kind: 'fix-ci', failed: checks.failed });
  for (const thread of state.threads) {
    if (thread.needs === 'judge') actions.push({ kind: 'judge', thread: thread.id });
    else if (thread.needs === 'mark-asked') actions.push({ kind: 'mark-asked', thread: thread.id });
  }
  actions.push({ kind: 'status' });
  return { mode: 'act', actions };
}
