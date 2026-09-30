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
// Actions: `merge-base` (`base`), `fix-ci` (`failed`: red, fixable and not stuck), `judge`
// (`thread`: no care reply yet), `mark-asked` (`thread`: a person had the last word after a care
// reply), `status`.

/**
 * @param {{ pr: { state: string, base: string }, checks: { state: string, failed: object[], stuck: boolean, fixable: boolean },
 *   mergeable: string, threads: Array<{ id: string, needs: 'judge' | 'mark-asked' | null }>,
 *   wave: { holdsClaims: boolean | null } }} state
 * @returns {{ mode: 'stop' | 'report-only' | 'act', actions: object[] }}
 */
export function decideRound(state) {
  if (state.pr.state !== 'OPEN') return { mode: 'stop', actions: [] };
  if (state.wave?.holdsClaims !== false) return { mode: 'report-only', actions: [{ kind: 'status' }] };

  const actions = [];
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
