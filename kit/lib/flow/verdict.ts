// A hook's verdict (PRD 1089): the last line a hook's output ends with, `omni-hook <point>: pass` or
// `omni-hook <point>: fail <why>`. Fail closed: output whose last line is not that point's verdict
// reads as `not ok … no verdict`, never as a pass. A pass may carry a note after `pass` (the merged
// PR's number at `wave.merge`), handed back as it is. Pure: it reads the text it is given.

export type Verdict = { ok: true; note: string | null } | { ok: false; why: string };

const VERDICT = /^omni-hook (\S+): (pass|fail)(?:\s+(.*))?$/;

/** The verdict `output` ends with for `point`. */
export function readVerdict(point: string, output: string): Verdict {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  const last = lines.at(-1) ?? '';
  const match = VERDICT.exec(last);
  if (!match) return { ok: false, why: 'no verdict' };
  const [, named = '', outcome, rest = ''] = match;
  if (named !== point) return { ok: false, why: `no verdict — the last line is ${named}'s verdict` };
  const text = rest.trim();
  return outcome === 'pass' ? { ok: true, note: text === '' ? null : text } : { ok: false, why: text === '' ? 'fail' : text };
}

/** The line `omni flow verdict` prints: `ok`, `ok <note>`, or `not ok <point> <why>`. */
export function verdictLine(point: string, verdict: Verdict): string {
  if (verdict.ok) return verdict.note === null ? 'ok' : `ok ${verdict.note}`;
  return `not ok ${point} ${verdict.why}`;
}

/** The verdict line a hook at `point` must end with, as a hook's author reads it. */
export const expectedVerdict = (point: string): string => `omni-hook ${point}: pass | omni-hook ${point}: fail <why>`;
