// A dossier and its versions as Supabase answers them (PRD 725, s3): a row of public.dossiers with
// its public.dossier_versions embedded (supabase/migrations/20260928090000_dossiers.sql).
// `game/dossiers/store.ts` reads them. They live with the game: the kit never names it (ADR-0002).
import { z } from 'zod';
import { PrdNumberSchema } from '../../kit/lib/ids.ts';

/** The kinds of version a dossier holds, as the dossier_versions table names them. */
export const VERSION_KINDS = ['spec', 'plan', 'before-after', 'variations', 'bug-record'] as const;

const DossierVersionRowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(VERSION_KINDS),
  git_blob: z.string().nullable(),
  bytes: z.number().int(),
});

export const DossierRowSchema = z.object({
  id: z.string().min(1),
  // A fix's dossier keeps its issue's number here (PRD 627), read as a PRD number as the arcade reads it.
  prd: PrdNumberSchema,
  title: z.string(),
  dossier_versions: z.array(DossierVersionRowSchema).default([]),
});
