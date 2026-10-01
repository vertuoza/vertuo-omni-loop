// A dossier and its versions as Supabase answers them (PRD 725, s3): a row of public.dossiers with
// its public.dossier_versions embedded (supabase/migrations/20260928090000_dossiers.sql).
// `game/dossiers/store.ts` reads them into a `Dossier` (`kit/lib/types.ts`).
import { z } from 'zod';

/** The kinds of version a dossier holds, as the dossier_versions table names them. */
export const VERSION_KINDS = ['spec', 'plan', 'before-after', 'variations', 'bug-record'] as const;

/** The kinds of dossier, part of its key (PRD 627). */
export const DOSSIER_KINDS = ['prd', 'visual', 'bug'] as const;

export const DossierVersionRowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(VERSION_KINDS),
  git_blob: z.string().nullable(),
  bytes: z.number().int(),
});

export const DossierRowSchema = z.object({
  id: z.string().min(1),
  prd: z.number().int().positive(),
  title: z.string(),
  dossier_versions: z.array(DossierVersionRowSchema).default([]),
});
