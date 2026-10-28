/**
 * What `omni rewind outcome <finding>` sends (PRD 2498, s2): the one thing `/omni:rewind-apply` did with an
 * approved finding, as the page's endpoint reads it. Pure: the three flags in, an outcome or the line that
 * refuses them out, so nothing is sent when the flags are wrong.
 *
 * - `--pr <n>`: a pull request proposes the rule.
 * - `--already <rule>`: a rule already says it (`playbook/<form>#<slot>` or a register entry's id), one line
 *   of at most 200 characters.
 * - `--asks <question>`: nothing fits or a locked law would change, so one question for a person, 2000
 *   characters at most.
 *
 * Exactly one of the three; a finding's outcome is written once, and the page refuses a second.
 */
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from '../ids.ts';

export type RewindOutcome =
  | { outcome: 'proposed'; pr: PrNumber }
  | { outcome: 'already' | 'asks'; note: string };

const ALREADY_MAX = 200;
const ASKS_MAX = 2000;

/** A finding's id, as the page names it. */
export const FindingIdSchema = z.uuid();

const DIGITS = /^\d+$/;

type Flags = { pull?: string | undefined; already?: string | undefined; asks?: string | undefined };

/** The outcome the three flags name, or the line saying why they name none. */
export function outcomeOf(flags: Flags): { ok: true; value: RewindOutcome } | { ok: false; error: string } {
  const given = [flags.pull, flags.already, flags.asks].filter((value) => value !== undefined).length;
  if (given !== 1) return { ok: false, error: 'give exactly one of --pr <n>, --already <rule> or --asks <question>.' };
  if (flags.pull !== undefined) {
    const pr = PrNumberSchema.safeParse(DIGITS.test(flags.pull) ? Number(flags.pull) : Number.NaN);
    return pr.success ? { ok: true, value: { outcome: 'proposed', pr: pr.data } } : { ok: false, error: `--pr must be a positive number, got "${flags.pull}".` };
  }
  if (flags.already !== undefined) {
    const note = flags.already.trim();
    if (note === '') return { ok: false, error: '--already needs the rule that already says it.' };
    if (note.length > ALREADY_MAX || /[\r\n]/.test(note)) return { ok: false, error: `--already is one line of at most ${String(ALREADY_MAX)} characters.` };
    return { ok: true, value: { outcome: 'already', note } };
  }
  const note = (flags.asks ?? '').trim();
  if (note === '') return { ok: false, error: '--asks needs the question.' };
  if (note.length > ASKS_MAX) return { ok: false, error: `--asks is at most ${String(ASKS_MAX)} characters.` };
  return { ok: true, value: { outcome: 'asks', note } };
}

/** The line `omni rewind outcome` prints once the page recorded `outcome` for `finding`. */
export function outcomeLine(finding: string, outcome: RewindOutcome): string {
  if (outcome.outcome === 'proposed') return `rewind outcome — finding ${finding}: rule proposed in PR #${String(outcome.pr)}.`;
  if (outcome.outcome === 'already') return `rewind outcome — finding ${finding}: already said by ${outcome.note}.`;
  return `rewind outcome — finding ${finding}: asks ${outcome.note}`;
}
