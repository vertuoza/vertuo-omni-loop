// What the canon gate reads from outside (PRD 839), as it reads it (PRD 725, s20): the business
// `business_for_repo_app` answers, the constituents `constituents_for_repo_app` answers (PRD 871), and
// each finding of the model's reply. Each schema names only
// the fields the gate uses and lets every other field through.
import { z } from 'zod';

/** A confirmed claim: its display id (`never#4`), its kind and its value. */
const ClaimSchema = z.looseObject({ id: z.string(), kind: z.string(), value: z.string().nullish() });

/** A persona of the repository's product: its name, and the lines that describe it. */
const PersonaSchema = z.looseObject({
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

/** A constituent: the Statement (id `statement`) or a Never line (id `never#<n>`), and its text. */
const ConstituentSchema = z.looseObject({ id: z.string(), text: z.string() });

/**
 * `constituents_for_repo_app(repo)` (PRD 871): `state` "ok" when the product has a live constituent,
 * its Statement (null with none), its live Never lines, and the id of its latest constituent event.
 */
export const ConstituentsSchema = z.looseObject({
  state: z.string().nullish(),
  statement: ConstituentSchema.nullish(),
  never: z.array(ConstituentSchema).nullish(),
  latestEventId: z.string().nullish(),
});

/** One finding of the model's reply: the spec's words, the claims they break, and why. */
export const FindingSchema = z.looseObject({ quote: z.string(), claims: z.array(z.string()), why: z.unknown().optional() });

/** The persona of the model's reply, read for its name and line, whatever they are. */
export const ReplyPersonaSchema = z.looseObject({ name: z.unknown().optional(), line: z.unknown().optional() });

export type Claim = z.infer<typeof ClaimSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Business = z.infer<typeof BusinessSchema>;
export type Constituent = z.infer<typeof ConstituentSchema>;
export type Constituents = z.infer<typeof ConstituentsSchema>;

/** `value` parsed by `schema`, or an error naming what was read and the first field it got wrong. */
function parsed<T>(schema: z.ZodType<T>, what: string, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const [issue] = result.error.issues;
  const field = issue && issue.path.length > 0 ? issue.path.join('.') : '(answer)';
  throw new Error(`the ${what} read is malformed: ${field}: ${issue?.message ?? result.error.message}`);
}

/** The business `value` is, or an error naming the first field it got wrong: `claims.0.id: …`. */
export const parseBusiness = (value: unknown): Business => parsed(BusinessSchema, 'business', value);

/** The constituents `value` is, or an error naming the first field it got wrong: `never.0.text: …`. */
export const parseConstituents = (value: unknown): Constituents => parsed(ConstituentsSchema, 'constituents', value);
