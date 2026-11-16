// The block of a work's status (PRD 2906's spec, "Solution"): pure. Always laid out the same way:
//
//   <verdict>
//
//   <kind> #<n> · <title>
//   Step <k> of <N>
//     ✓ <done>  ▶ <the step it is at, in its name>  ○ <to come>
//
//   You: <what the person must do, or nothing>
//   Next: <one or two items>
//
//   <page label>:   <the work's Omni page, else its GitHub issue>
//   Pull request: <its pull request>  (<the explanation, when no line above gave it>)
//   Details (RAW, the check's real name, for developers): <check> · failed     ← one per failed check, at most three
//   <the freshness line>
//
// - A technical word is explained the first time it appears in the block, and only then
//   (`words.ts`); the pull request's link carries its explanation after the address.
// - The step line names the steps done and to come by their short names, and the step the work is at
//   by its name. The links' labels are aligned; a work with no link has no link lines.
// - **The freshness line:** `Checked just now.` when GitHub answered this read; `Checked <m> min ago
//   (GitHub did not answer).` when it did not, `<m>` the age of the copy shown, at least 1;
//   `Checked <m> min ago.` when this read did not ask it, `just now` under a minute. With no copy:
//   `Not checked yet (GitHub did not answer).`, or `Not checked with GitHub yet.`.
// - The **Right now** line is the agent's (`/omni:status`): it is never printed here.
import { readStatus } from './steps.ts';
import type { Status, StatusChecked, StatusFacts } from './steps.ts';
import { DETAILS_FAILED, DETAILS_LABEL, explainer, fill, FRESHNESS, KIND_NAMES, LINK_LABELS, PAGE_LABELS, TERMS } from './words.ts';

const MARKS = Object.freeze({ done: '✓', at: '▶', toCome: '○' });
const MAX_NEXT = 2;
const MAX_DETAILS = 3;
const MINUTE_MS = 60_000;

/** The step line: every step of the work's kind, marked done, at or to come. */
function stepLine({ steps, at }: Status, say: (text: string) => string): string {
  const items = steps.map((entry, index) => {
    if (index + 1 < at) return `${MARKS.done} ${entry.short}`;
    return index + 1 === at ? `${MARKS.at} ${say(entry.name)}` : `${MARKS.toCome} ${entry.short}`;
  });
  return `  ${items.join('  ')}`;
}

/** The links' lines: the work's page, else its issue, then its pull request, labels aligned. */
function linkLines(facts: StatusFacts, first: (term: 'pull request') => boolean): string[] {
  const { page, issueUrl, pullRequest } = facts.links;
  const rows: [string, string][] = [];
  if (page) rows.push([PAGE_LABELS[facts.kind], page]);
  else if (issueUrl) rows.push([LINK_LABELS.issue, issueUrl]);
  if (pullRequest) rows.push([LINK_LABELS.pullRequest, first('pull request') ? `${pullRequest}  (${TERMS['pull request']})` : pullRequest]);
  const width = Math.max(0, ...rows.map(([label]) => label.length)) + 2;
  return rows.map(([label, value]) => `${`${label}:`.padEnd(width)}${value}`);
}

/** The freshness line, as of `now` (milliseconds). */
function freshnessLine({ at, fetch }: StatusChecked, now: number): string {
  if (fetch === 'answered') return FRESHNESS.now;
  const read = at === null ? Number.NaN : Date.parse(at);
  if (Number.isNaN(read)) return fetch === 'no-answer' ? FRESHNESS.noAnswerNever : FRESHNESS.notAskedNever;
  const minutes = Math.floor(Math.max(0, now - read) / MINUTE_MS);
  if (fetch === 'no-answer') return fill(FRESHNESS.noAnswer, { m: Math.max(1, minutes) });
  return minutes < 1 ? FRESHNESS.now : fill(FRESHNESS.notAsked, { m: minutes });
}

/** The block of `status`, the status of the work whose facts are `facts`, as of `now` (milliseconds). */
export function renderStatus(status: Status, facts: StatusFacts, now: number): string[] {
  const { say, first } = explainer();
  const head = [say(status.verdict.line), '', say(`${KIND_NAMES[facts.kind]} #${String(facts.number)} · `) + facts.title, `Step ${String(status.at)} of ${String(status.steps.length)}`, stepLine(status, say)];
  const asks = [say(`You: ${status.you}`), say(`Next: ${status.next.slice(0, MAX_NEXT).join('; ')}.`)];
  const details = status.details.slice(0, MAX_DETAILS).map((name) => `${DETAILS_LABEL}: ${name} · ${DETAILS_FAILED}`);
  const tail = [...linkLines(facts, first), ...details, freshnessLine(facts.checked, now)];
  return [...head, '', ...asks, '', ...tail];
}

/** The block of the work whose facts are `facts`, as of `now` (milliseconds). */
export const statusBlock = (facts: StatusFacts, now: number): string[] => renderStatus(readStatus(facts), facts, now);
