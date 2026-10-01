// What the canon gate reads from outside (PRD 839), as it reads it (PRD 725, s20): the business
// `business_for_repo_app` answers, and each finding of the model's reply. Each schema names only
// the fields the gate uses and lets every other field through.
import { z } from 'zod';

/** A confirmed claim: its display id (`never#4`), its kind and its value. */
export const ClaimSchema = z.looseObject({ id: z.string(), kind: z.string(), value: z.string().nullish() });

/** A persona of the repository's product: its name, and the lines that describe it. */
export const PersonaSchema = z.looseObject({
  name: z.string(),
  who: z.string().nullish(),
  trade: z.string().nullish(),
  stance: z.string().nullish(),
  usage: z.string().nullish(),
});

/**
 * `business_for_repo_app(repo)`: the business tracking the repository (null with none), its confirmed
 * claims and personas, and when one last changed.
 */
export const BusinessSchema = z.looseObject({
  business: z.unknown().optional(),
  claims: z.array(ClaimSchema).nullish(),
  personas: z.array(PersonaSchema).nullish(),
  updatedAt: z.string().nullish(),
});

/** One finding of the model's reply: the spec's words, the claims they break, and why. */
export const FindingSchema = z.looseObject({ quote: z.string(), claims: z.array(z.string()), why: z.unknown().optional() });

/** The persona of the model's reply, read for its name and line, whatever they are. */
export const ReplyPersonaSchema = z.looseObject({ name: z.unknown().optional(), line: z.unknown().optional() });

export type Claim = z.infer<typeof ClaimSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Business = z.infer<typeof BusinessSchema>;

/** The business `value` is, or an error naming the first field it got wrong: `claims.0.id: …`. */
export function parseBusiness(value: unknown): Business {
  const parsed = BusinessSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  const field = issue && issue.path.length > 0 ? issue.path.join('.') : '(answer)';
  throw new Error(`the business read is malformed: ${field}: ${issue?.message ?? parsed.error.message}`);
}
