/**
 * **A mission outbox item** (PRD 3065, spec "5. Rule changes: the mission's own outbox").
 *
 * When a stuck repair or a milestone retro finds a rule, a law or a playbook form wrong, it never changes it: it proposes the change
 * as an item holding what it proposes to change (a rule or law by its id, or a playbook form and its section), the wording it
 * proposes, and its evidence as sentences citing the retro. An item is always high and never pauses a mission; a member answers it
 * once (BR-PRODUCT-12), and an agent never applies it.
 *
 * Pure: no filesystem, no network, no clock.
 */
import { z } from 'zod';
import { holdsToken } from '../repair/sensitive.ts';
import { CitedSentencesSchema } from './retro-cited.ts';

/** The longest wording an item proposes. */
const WORDING_MAX = 1200;

const IdSchema = z.string().trim().min(1).max(120).regex(/^[^\s]+$/, 'an id has no space');
const NameSchema = z.string().trim().min(1).max(120).refine((text) => !/[\r\n]/.test(text), 'on one line');

/** What an item proposes to change: a rule or a law by its id, or a playbook form and its section. */
const MissionItemTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('rule'), id: IdSchema }),
  z.strictObject({ kind: z.literal('law'), id: IdSchema }),
  z.strictObject({ kind: z.literal('form'), form: NameSchema, section: NameSchema }),
]);

/** A mission item, as a retro writes it into its record line and into a file of the mission's outbox. */
export const MissionItemSchema = z.strictObject({
  target: MissionItemTargetSchema,
  wording: z
    .string()
    .trim()
    .min(1)
    .max(WORDING_MAX)
    .refine((text) => !holdsToken(text), 'an item never holds a credential in clear'),
  evidence: CitedSentencesSchema,
});
