// A hook's verdict (PRD 1089): the last line a hook's output ends with, `omni-hook <point>: pass` or
// `omni-hook <point>: fail <why>`. Fail closed: output whose last line is not that point's verdict
// reads as `not ok … no verdict`, never as a pass. A pass may carry a note after `pass` (the merged
// PR's number at `wave.merge`), handed back as it is. A point the catalog lets wait
// (`merge-after.served`, PRD 2746) may also end `wait <why>`: not yet, ask again, which is never a
// pass; at any other point a `wait` is refused. Pure: it reads the text it is given.
import { flowPoint } from './points.ts';

export type Verdict = { ok: true; note: string | null } | { ok: false; why: string; wait?: true };

const VERDICT = /^omni-hook (\S+): (pass|wait|fail)(?:\s+(.*))?$/;

const waits = (point: string): boolean => flowPoint(point)?.waits === true;

/** The verdict `output` ends with for `point`. */
export function readVerdict(point: string, output: string): Verdict {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  const last = lines.at(-1) ?? '';
  const match = VERDICT.exec(last);
  if (!match) return { ok: false, why: 'no verdict' };
  const [, named = '', outcome, rest = ''] = match;
  if (named !== point) return { ok: false, why: `no verdict — the last line is ${named}'s verdict` };
  const text = rest.trim();
  if (outcome === 'wait') {
    if (!waits(point)) return { ok: false, why: `wait is not a verdict of ${point}: it takes pass or fail` };
    return { ok: false, wait: true, why: text === '' ? 'not served yet' : text };
  }
  return outcome === 'pass' ? { ok: true, note: text === '' ? null : text } : { ok: false, why: text === '' ? 'fail' : text };
}

/** The line `omni flow verdict` prints: `ok`, `ok <note>`, `wait <point> <why>` or `not ok <point> <why>`. */
export function verdictLine(point: string, verdict: Verdict): string {
  if (verdict.ok) return verdict.note === null ? 'ok' : `ok ${verdict.note}`;
  return `${verdict.wait === true ? 'wait' : 'not ok'} ${point} ${verdict.why}`;
}

/** The verdict line a hook at `point` must end with, as a hook's author reads it. */
export const expectedVerdict = (point: string): string =>
  [`omni-hook ${point}: pass`, ...(waits(point) ? [`omni-hook ${point}: wait <why>`] : []), `omni-hook ${point}: fail <why>`].join(' | ');
