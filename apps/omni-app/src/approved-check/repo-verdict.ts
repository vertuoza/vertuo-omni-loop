// The approved check's judgement of a ◆ PRD of a repository (PRD 1612, folded into PRD 1548's check),
// pure. A ◆ PRD (its feature PR, or a target PR whose body starts `Part of <owner/repo>#<n>`) has no
// product record: the kit's one judge reads it against the pull request's head (`judgeApproval`,
// kit/lib/approval/approval.ts), and `repoApprovedVerdict` says that reading in the check's one set of
// states (./state.ts), each named once. PRD 1612's own names map onto them:
//
// | the kit's reading                                                  | PRD 1612 said | state      | conclusion |
// |--------------------------------------------------------------------|---------------|------------|------------|
// | `approved`                                                         | approved      | `building` | success    |
// | `pending`                                                          | waiting       | `pending`  | failure    |
// | `drifted`                                                          | drifted       | `drifted`  | failure    |
// | `refused`, the approver no longer a member                         | held          | `refused`  | failure    |
// | `refused` by an error page or a malformed reply, or `unreachable`  | held          | `held`     | neutral    |
//
// A drift at a head names the file and that head (`≠ plan.md in <head> · content`), a voided pin the
// push that voided it; its summary says to run `omni approval restore <n>`. The Details open the PRD
// page's approval, whose dossier the page's link names.
//
// It reads the kit's `ApprovalReading` through `HeadReading`, the part of it this module reads, so it
// imports the check's types from ./state.ts alone.
import { basename } from 'node:path';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ApprovedState, ApprovedVerdict, PinDrift } from './state.ts';

/** The line of a reading the server never got to judge: the kit's `UNREACHABLE_LINE`. */
const UNREACHABLE = 'server unreachable · held, not failed';

/** A drift as the kit's judge names it: a pinned file's kind, its file at the head, and how. */
type HeadDrift = { kind: string; file: string; how: PinDrift['how'] };

/** The kit's reading of a ◆ PRD at a head (`ApprovalReading`, kit/lib/approval/approval.ts), as far as the check reads it. */
export type HeadReading = {
  state: 'approved' | 'pending' | 'drifted' | 'unreachable' | 'refused';
  lines: string[];
  url: string | null;
  approval: { approver: { login: string; member: boolean }; files: readonly unknown[]; voids?: readonly { pusher: string; kind: string }[] | undefined } | null;
  drift: HeadDrift[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The dossier of a PRD page's link, `<galaxy>/prd/<dossier>`; null when the link names none. */
export function dossierOf(url: string | null): string | null {
  const last = url?.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
  return UUID.test(last) ? last : null;
}

/** One drift the kit's judge found at `head`, as the check names it. */
function headDrift(drift: HeadDrift, reading: HeadReading, head: string): PinDrift {
  const file = basename(drift.file);
  if (drift.how !== 'voided') return { file, how: drift.how, where: drift.how === 'missing' ? null : head.slice(0, 7) };
  const voided = (reading.approval?.voids ?? []).find((v) => v.kind === drift.kind);
  return { file, how: 'voided', where: voided ? `${voided.pusher}'s push` : null };
}

/** One drift as the check's line says it, as ./state.ts says a product PRD's. */
function lineOf({ file, how, where }: PinDrift): string {
  if (how === 'voided') return `≠ ${file} · voided by ${where ?? 'a push'}`;
  return how === 'missing' ? `≠ ${file} · missing` : `≠ ${file} in ${where ?? 'the head'} · ${how}`;
}

/** The approved check's verdict for ◆ PRD `prd` of a repository, from the kit's reading of it at `head`. */
export function repoApprovedVerdict(prd: PrdNumber, reading: HeadReading, head: string): ApprovedVerdict {
  const n = Number(prd);
  const dossierId = dossierOf(reading.url);
  const verdict = (state: ApprovedState, conclusion: ApprovedVerdict['conclusion'], title: string, lines: string[], drift: PinDrift[] = []): ApprovedVerdict =>
    ({ state, conclusion, title, summary: [...lines, '', `Read against ${head}.`].join('\n'), dossierId, drift });
  const { approval } = reading;
  const held = () => verdict('held', 'neutral', `held · ${UNREACHABLE}`, reading.lines);
  switch (reading.state) {
    case 'approved': {
      const pinned = approval?.files.length ?? 0;
      return verdict('building', 'success', `building · ${pinned} of ${pinned} pinned`, reading.lines);
    }
    case 'pending':
      return verdict('pending', 'failure', `pending · PRD ${n} waits for approval`, reading.lines);
    case 'drifted': {
      const drift = reading.drift.map((d) => headDrift(d, reading, head));
      const lines = drift.map(lineOf);
      const restore = `Run \`omni approval restore ${n}\` to write each drifted file back to its approved content, or approve again on the PRD page.`;
      return verdict('drifted', 'failure', `drifted · ${lines[0] ?? ''}`, [...lines, '', restore], drift);
    }
    case 'refused':
      return approval && !approval.approver.member
        ? verdict('refused', 'failure', `refused · approver ${approval.approver.login} is not a workspace member`, reading.lines)
        : held();
    case 'unreachable':
      return held();
  }
}
