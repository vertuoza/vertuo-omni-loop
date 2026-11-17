/**
 * **A repair's retro** (PRD 2980, spec "2. `/omni:repair`: a retro, then one of four ways").
 *
 * `/omni:repair` reads why a mission's step failed and writes it down: the cause in one sentence, its class, where it failed (a
 * file, a command or a skill), the error's signature, the evidence as sentences (never a log excerpt), the proposed fix and the
 * fingerprint. The retro is kept in the workspace's `mission_repairs` rows, read by its members only; it never holds a credential
 * in clear (L-GDPR-2).
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { FingerprintSchema, REPAIR_CLASSES } from './fingerprint.ts';
import { holdsToken } from './sensitive.ts';

/** The longest sentence a retro holds. */
const SENTENCE_MAX = 240;
/** The longest place, signature or proposed fix. */
const LINE_MAX = 400;
/** The most evidence sentences a retro holds. */
const EVIDENCE_MAX = 8;

/** A sentence's end followed by another sentence's start: a dot inside a word or a number (`sum.ts`, `2.5`, `e.g.`) is not one. */
const NEXT_SENTENCE = /[.!?]["')\]]?\s+[A-Z0-9`"'(]/;

/** Whether `text` is one sentence: on one line, not too long, with no second sentence after the first. */
export function isOneSentence(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= SENTENCE_MAX && !/[\r\n]/.test(trimmed) && !NEXT_SENTENCE.test(trimmed);
}

const NO_TOKEN = 'a retro never holds a credential in clear';

const SentenceSchema = z
  .string()
  .refine(isOneSentence, `one sentence, on one line, at most ${String(SENTENCE_MAX)} characters`)
  .refine((text) => !holdsToken(text), NO_TOKEN);

const LineSchema = z
  .string()
  .trim()
  .min(1)
  .max(LINE_MAX)
  .refine((text) => !/[\r\n]/.test(text), 'on one line')
  .refine((text) => !holdsToken(text), NO_TOKEN);

/** A repair's class, one of the four ways. */
export const RepairClassSchema = z.enum(REPAIR_CLASSES);

/** A repair's retro, as `/omni:repair` writes it into its record line. */
export const RepairRetroSchema = z.object({
  cause: SentenceSchema,
  class: RepairClassSchema,
  place: LineSchema,
  signature: LineSchema,
  evidence: z.array(SentenceSchema).min(1).max(EVIDENCE_MAX),
  proposedFix: LineSchema,
  fingerprint: FingerprintSchema,
});

/** A repair's retro. */
export type RepairRetro = z.infer<typeof RepairRetroSchema>;
