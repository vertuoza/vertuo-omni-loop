/**
 * **A cited sentence** (PRD 3065, spec "3. A milestone retro"): what a retro or a mission item says, one sentence at a time, each
 * citing an event, a PRD, a pull request or a repair of its mission. A sentence that cites nothing is refused, naming it (AC-10);
 * so is a log excerpt shape (several lines, a time stamp, a credential) and a sentence of more than one thought.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { isOneSentence } from '../repair/retro.ts';
import { holdsToken } from '../repair/sensitive.ts';

/** What a sentence may cite. */
const CITE_KINDS = ['event', 'prd', 'pr', 'repair'] as const;

/** The most sentences one side of a retro, or one item's evidence, holds. */
const SENTENCES_MAX = 5;

/** The time stamp a runner's log puts before a line: a sentence that starts with one is a log excerpt. */
const LOG_STAMP = /^\d{2}:\d{2}:\d{2}\b/;

const CiteSchema = z.strictObject({
  kind: z.enum(CITE_KINDS),
  ref: z.number().int().positive(),
});

/** One sentence and what it cites. */
const CitedSentenceSchema = z
  .strictObject({
    text: z
      .string()
      .refine(isOneSentence, 'one sentence, on one line, at most 240 characters')
      .refine((text) => !LOG_STAMP.test(text.trim()), 'a retro never holds a log excerpt')
      .refine((text) => !holdsToken(text), 'a retro never holds a credential in clear'),
    cites: z.array(CiteSchema),
  })
  .superRefine((sentence, ctx) => {
    if (sentence.cites.length === 0) {
      ctx.addIssue({ code: 'custom', message: `the sentence "${sentence.text}" cites no event, PRD, pull request or repair`, path: ['cites'] });
    }
  });

/** One to five cited sentences. */
export const CitedSentencesSchema = z.array(CitedSentenceSchema).min(1).max(SENTENCES_MAX);
