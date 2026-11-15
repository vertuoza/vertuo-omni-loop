// The `omni / ready` check run's output (PRD 2898 s7): the ready rule's verdict as GitHub shows it. Its
// title is the verdict's headline, its summary the five checks in order, each with its state (`pass`,
// `fail`, `not finished`, `not judged · <why>`), why, and a link to its evidence, then the App's
// signature: the check is the App's own status record, never a person's answer (BL-ASK-1, L-AIACT-1).
//
// | the verdict                        | the check run                                         |
// |------------------------------------|-------------------------------------------------------|
// | ready, five checks pass            | completed, `success`                                  |
// | not ready, a check fails           | completed, `failure`                                  |
// | not finished, evidence still going | `in_progress`: shown as not finished, never green     |
// | not finished, only not judged      | completed, `neutral`: nothing more will come to judge |
import { footerLine, type FooterSignature } from 'omni-loop/kit/lib/signature.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { readyVerdict } from 'omni-loop/kit/lib/ready/checks.ts';
import { MAX_SUMMARY } from '../publish/publish.ts';

/** The verdict the kit's rule gives. */
export type Verdict = ReturnType<typeof readyVerdict>;

/** The `external_id` every ready check run carries, so the webhook tells a re-run of it. */
export const READY_EXTERNAL_ID = 'omni-loop/ready';

/** How the run stands: completed with a conclusion, or still going. */
export type ReadyRunState = { status: 'completed'; conclusion: 'success' | 'failure' | 'neutral' } | { status: 'in_progress' };

/** What the check run says. */
export type ReadyOutput = ReadyRunState & { title: string; summary: string };

/** What a check's state reads as, on its line. */
const MARK: Readonly<Record<Verdict['checks'][number]['state'], string>> = Object.freeze({
  pass: '✓',
  fail: '✗',
  'not finished': '…',
  'not judged': '?',
});

/** The line that says who posted the check: the App, never a person. */
export const POSTED_BY = 'Posted by the Omni App on its own: a status record, never a person’s answer.';

/** The line a ready verdict ends on: ready is never merged. */
export const NOT_MERGED = 'Ready for review, not merged. Only a person merges.';

/** One check's state as the spec words it: `not judged · <why>` carries its why. */
const stateText = (check: Verdict['checks'][number]) => (check.state === 'not judged' ? `not judged · ${check.why}` : check.state);

/** One check's line: its number, mark, title, state, why and evidence. */
function checkLine(check: Verdict['checks'][number], index: number): string {
  const why = check.state === 'not judged' ? '' : ` — ${check.why}`;
  const evidence = check.evidence === null ? '' : ` · [evidence](${check.evidence})`;
  return `${String(index + 1)}. ${MARK[check.state]} **${check.title}** · ${stateText(check)}${why}${evidence}`;
}

/** How the run stands for `verdict`. */
function runState(verdict: Verdict): ReadyRunState {
  if (verdict.state === 'ready') return { status: 'completed', conclusion: 'success' };
  if (verdict.state === 'not ready') return { status: 'completed', conclusion: 'failure' };
  return verdict.checks.some((check) => check.state === 'not finished') ? { status: 'in_progress' } : { status: 'completed', conclusion: 'neutral' };
}

/** The check run the verdict on PRD `prd` asks for, signed with `signature` when signing is on. */
export function readyOutput(verdict: Verdict, { prd, signature }: { prd: PrdNumber; signature: FooterSignature | null }): ReadyOutput {
  const footer = footerLine(signature);
  const lines = [
    `PRD ${String(prd)} · **${verdict.headline}**`,
    '',
    ...verdict.checks.map(checkLine),
    '',
    ...(verdict.ready ? [NOT_MERGED, ''] : []),
    POSTED_BY,
    ...(footer === null ? [] : ['', footer]),
  ];
  return { ...runState(verdict), title: verdict.headline, summary: lines.join('\n').slice(0, MAX_SUMMARY) };
}

/** The check run of a verdict that could not be read at all: completed `neutral`, every check not judged, saying why. */
export function notJudgedOutput(reason: string): ReadyOutput {
  const title = `Not judged · the check could not run`;
  return { status: 'completed', conclusion: 'neutral', title, summary: [`Not judged: ${reason}.`, '', POSTED_BY].join('\n').slice(0, MAX_SUMMARY) };
}
