/**
 * **The committee's vote** (PRD 2896 s9, spec "6. The committee, at `alone`").
 *
 * The PM chairs; the Architect and the Reviewer sit on it. The hero whose job wrote the PRD (or raised the item)
 * sits out and never votes on it. Each member answers `yes`, `no` or `unsure` with one sentence; a member whose
 * agent failed is recorded `failed`, one that gave no verdict in time `timeout`, and both count as `unsure`.
 *
 * Every member who sits must answer `yes`: three `yes`, or two when one sits out. Anything else escalates to a
 * person, the verdicts attached, each reason in one line. A verdict from the author, or two from one member,
 * escalates too: a vote that cannot be read whole is never carried.
 *
 * Pure: no filesystem, no network, no clock. The App reads the same function, so the job's own word on its
 * outcome is never what carries a decision.
 */
import { z } from 'zod';

/** The committee's members, the chair first. */
export const COMMITTEE_ROLES = Object.freeze(['pm', 'architect', 'reviewer'] as const);

export type CommitteeRole = (typeof COMMITTEE_ROLES)[number];

export const CommitteeRoleSchema = z.enum(COMMITTEE_ROLES);

/** What a member's verdict may read: its three answers, then how a member that gave none is recorded. */
const VERDICT_ANSWERS = Object.freeze(['yes', 'no', 'unsure', 'failed', 'timeout'] as const);

/** The longest sentence a verdict carries. */
const SENTENCE_MAX = 200;

export const VerdictSchema = z.object({
  role: CommitteeRoleSchema,
  answer: z.enum(VERDICT_ANSWERS),
  sentence: z
    .string()
    .trim()
    .min(1, 'sentence: one sentence, not empty')
    .max(SENTENCE_MAX, `sentence: ${String(SENTENCE_MAX)} characters at most`)
    .refine((text) => !/[\r\n]/.test(text), 'sentence: on one line'),
});

/** One member's verdict. */
export type Verdict = z.infer<typeof VerdictSchema>;

/** What a vote comes to: carried, or escalated with why, one line each; the verdicts as recorded, in the committee's order. */
export type Tally = { outcome: 'carried' | 'escalated'; why: string[]; verdicts: Verdict[] };

const NAMES: Readonly<Record<CommitteeRole, string>> = { pm: 'PM', architect: 'Architect', reviewer: 'Reviewer' };

/** A member's name, as the committee's lines say it. */
const roleName = (role: CommitteeRole): string => `the ${NAMES[role]}`;

/** The members who vote: all three, but the hero whose job wrote the PRD. */
export const sitting = (author: CommitteeRole | null): CommitteeRole[] => COMMITTEE_ROLES.filter((role) => role !== author);

/** Why a verdict that is not `yes` escalates. */
function whyOf({ role, answer, sentence }: Verdict): string {
  if (answer === 'failed') return `${roleName(role)} failed, counted unsure: ${sentence}`;
  if (answer === 'timeout') return `${roleName(role)} timed out, counted unsure: ${sentence}`;
  return `${roleName(role)} answered ${answer}: ${sentence}`;
}

const NO_VERDICT = 'It gave no verdict.';

/** The vote on `verdicts`, the hero `author` sitting out (null when no hero of the fleet wrote it). */
export function tally(verdicts: readonly Verdict[], author: CommitteeRole | null): Tally {
  const why: string[] = [];
  if (author !== null && verdicts.some((verdict) => verdict.role === author)) why.push(`${roleName(author)} wrote it and may not vote on it`);
  for (const role of COMMITTEE_ROLES) if (verdicts.filter((verdict) => verdict.role === role).length > 1) why.push(`${roleName(role)} answered twice`);
  const recorded: Verdict[] = sitting(author).map((role) => verdicts.find((verdict) => verdict.role === role) ?? { role, answer: 'failed', sentence: NO_VERDICT });
  if (why.length === 0) why.push(...recorded.filter((verdict) => verdict.answer !== 'yes').map(whyOf));
  return { outcome: why.length === 0 ? 'carried' : 'escalated', why, verdicts: recorded };
}

/** The file a committee's members' verdicts are written to: `{ "verdicts": [{ "role", "answer", "sentence" }] }`. */
const VotesSchema = z.object({ verdicts: z.array(VerdictSchema).max(COMMITTEE_ROLES.length + 1) });

/** The verdicts of a votes file, or every field it is refused for, one line each. */
export function parseVotes(input: unknown): { ok: true; verdicts: Verdict[] } | { ok: false; errors: string[] } {
  const parsed = VotesSchema.safeParse(input);
  if (parsed.success) return { ok: true, verdicts: parsed.data.verdicts };
  return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'votes'}: ${issue.message}`) };
}
