// The business laws' verdicts in the database (PRD 2632 s4; ADR-0095), on the client it is given, every answer
// parsed where it comes in (supabase/migrations/20270111090000_business_law_verdicts.sql):
//
// - `judgeInput` and `put`, on the service role's client: what the judge reads of a dossier, and the verdict it
//   keeps, once per spec version and pack commit (the first one stands);
// - `standing`, on the caller's own client: where a dossier's latest spec stands (its law home, that home's
//   newest pack, the verdict kept there), or a spec version's latest verdict; null for anyone but a member.
//
// A refusal, or an answer out of shape, throws, naming the function: the callers never turn it red.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { LawVerdict } from './judge.service';

/** What the functions need: the database's functions. */
export type VerdictsDb = Pick<SupabaseClient, 'rpc'>;

const text = z.string().min(1);

const FindingSchema = z.object({
  law: text,
  statement: z.string(),
  why: z.string(),
  quote: text,
  domain: z.string(),
  file: z.string(),
  owners: z.array(z.string()),
});

const DomainSchema = z.object({ key: text, reasons: z.array(z.string()), name: z.string().optional() });

const KeptSchema = z.object({
  specVersion: text,
  lawHome: text,
  packSha: text,
  state: z.enum(['green', 'red', 'neutral']),
  reason: text,
  laws: z.array(text),
  domains: z.array(DomainSchema),
  findings: z.array(FindingSchema),
  judgedAt: text,
});

/** A verdict as the database keeps it: the spec version and pack commit it was judged at, and when. */
export type KeptVerdict = z.infer<typeof KeptSchema>;

const InputSchema = z.object({
  dossier: text,
  server: z.boolean(),
  specVersion: text.nullable(),
  spec: z.string().nullable(),
  lawHome: text.nullable(),
  pack: z.object({ sha: text, files: z.array(z.object({ path: text, content: z.string() })) }).nullable(),
  glossary: z.array(z.object({ term: text, avoid: z.array(z.string()), domains: z.array(z.string()).optional() })),
  domains: z.array(z.object({ key: text, name: z.string() })),
  verdict: KeptSchema.nullable(),
});

/** What the judge reads of a dossier. */
export type JudgeInput = z.infer<typeof InputSchema>;

const StandingSchema = z.object({
  dossier: text,
  specVersion: text.nullable(),
  lawHome: text.nullable(),
  packSha: text.nullable(),
  verdict: KeptSchema.nullable(),
});

/** Where a dossier's spec stands with its business laws, as a member reads it. */
export type Standing = z.infer<typeof StandingSchema>;

type Raw = { data: unknown; error: { message?: string; code?: string } | null };

async function answered<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, name: string): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(`${name}: the database refused: ${error.message ?? error.code ?? 'no reason given'}`);
  const read = schema.safeParse(data);
  if (!read.success) throw new Error(`${name}: answered out of shape`);
  return read.data;
}

export function verdictsRepository(db: VerdictsDb) {
  return {
    /** What the judge reads of dossier `dossier`; null when there is none. The service role's. */
    judgeInput(dossier: string): Promise<JudgeInput | null> {
      return answered(db.rpc('business_law_judge_input', { p_dossier: dossier }), InputSchema.nullable(), 'business_law_judge_input');
    },

    /** Keeps `verdict` on spec version `version` at pack commit `sha`, unless one is kept there: the one kept. The service role's. */
    put(version: string, sha: string, verdict: LawVerdict): Promise<KeptVerdict> {
      return answered(db.rpc('business_law_verdict_put', {
        p_version: version,
        p_pack_sha: sha,
        p_state: verdict.state,
        p_reason: verdict.reason,
        p_laws: verdict.laws,
        p_domains: verdict.domains,
        p_findings: verdict.findings,
      }), KeptSchema, 'business_law_verdict_put');
    },

    /** Where dossier `dossier`'s latest spec stands, or spec version `version`'s latest verdict, as the caller reads it. */
    standing(dossier: string, version: string | null = null): Promise<Standing | null> {
      return answered(db.rpc('business_law_verdict_of', { p_dossier: dossier, ...(version === null ? {} : { p_version: version }) }), StandingSchema.nullable(), 'business_law_verdict_of');
    },
  };
}

export type VerdictsRepository = ReturnType<typeof verdictsRepository>;
