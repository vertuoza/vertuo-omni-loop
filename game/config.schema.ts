// The game's org facts as Supabase answers them (PRD 725, s3): a sector (public.sectors), a fleet
// (public.teams), a roster line (public.players) and a tracked repository (public.repositories).
// `game/config.ts` folds them into its lookups. They live with the game: the kit never names it (ADR-0002).
import { z } from 'zod';

export const SectorRowSchema = z.object({ name: z.string().min(1), repos: z.array(z.string().min(1)).nullable().default([]) });

export const FleetRowSchema = z.object({
  name: z.string().min(1),
  home: z.string().min(1).nullable().default(null),
  label: z.string().min(1).optional(),
  color: z.string().optional(),
  motto: z.string().optional(),
  mascot: z.string().nullable().optional(),
  sort: z.number().optional(),
  retired_at: z.string().nullable().optional(),
});

export const RosterRowSchema = z.object({ github_login: z.string().min(1), team: z.string().min(1) });

export const RepositoryRowSchema = z.object({ full_name: z.string().min(3), tracked: z.boolean().default(true) });
