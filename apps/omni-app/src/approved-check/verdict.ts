// What the `omni/approved` check says (PRD 1612), pure: a reading of the kit's shared judge in, the
// check run's conclusion, title, summary and Details link out, in the four states of the spec's table:
//
// | state    | conclusion | title                                                                                  |
// |----------|------------|----------------------------------------------------------------------------------------|
// | approved | success    | `approved by @<login> · <k>/<k> pinned files match`                                    |
// | waiting  | neutral    | `waits for approval: <PRD page>`                                                       |
// | drifted  | failure    | `≠ <file> · content` (or `· whitespace only`) `· run omni approval restore <n>, or approve again` |
// | held     | neutral    | `server unreachable · held, not failed`                                                |
//
// The Details link opens the attestation, `<PRD page>/attestation?head=<sha>`; a held check, whose
// reply never came, has none.
import { basename } from 'node:path';
import { UNREACHABLE_LINE, verdictOf, type ApprovalReading, type ApprovalVerdict } from 'vertuo-omni-plan/kit/lib/approval/approval.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** A completed check run's conclusion, title, summary and Details link. */
export type ApprovedOutput = {
  verdict: ApprovalVerdict;
  conclusion: 'success' | 'neutral' | 'failure';
  title: string;
  summary: string;
  detailsUrl: string | null;
};

/** The attestation of the PRD page `url` at `head`. */
function attestationUrl(url: string, head: string): string {
  return `${url.replace(/\/+$/, '')}/attestation?head=${encodeURIComponent(head)}`;
}

/** The check of a reading of PRD `prd`, judged against the tree at `head`. */
export function approvedOutput(prd: PrdNumber, reading: ApprovalReading, head: string): ApprovedOutput {
  const verdict = verdictOf(reading);
  const detailsUrl = reading.url ? attestationUrl(reading.url, head) : null;
  const summary = [...reading.lines, '', `Read against ${head}.`].join('\n');
  switch (verdict) {
    case 'approved': {
      // The personas' rounds (voice) are never judged (the kit's judge, PRD 1322).
      const k = (reading.approval?.files ?? []).filter((file) => file.kind !== 'voice').length;
      return { verdict, conclusion: 'success', title: `approved by @${reading.approval?.approver.login ?? '?'} · ${k}/${k} pinned files match`, summary, detailsUrl };
    }
    case 'waiting':
      return { verdict, conclusion: 'neutral', title: `waits for approval: ${reading.url ?? ''}`, summary, detailsUrl };
    case 'drifted': {
      const files = reading.drift.map((d) => `≠ ${basename(d.file)} · ${d.how}`).join(' · ');
      const restore = `omni approval restore ${Number(prd)}`;
      return {
        verdict,
        conclusion: 'failure',
        title: `${files} · run ${restore}, or approve again`,
        summary: [`Run \`${restore}\` to write each drifted file back to its approved content, or approve the PRD again on its page.`, '', summary].join('\n'),
        detailsUrl,
      };
    }
    case 'held':
      return { verdict, conclusion: 'neutral', title: UNREACHABLE_LINE, summary, detailsUrl };
  }
}

/** The reading of a check held before the judge could answer, saying why. */
export function heldReading(why: string): ApprovalReading {
  return { state: 'unreachable', lines: [UNREACHABLE_LINE, why], url: null, approval: null, drift: [] };
}
