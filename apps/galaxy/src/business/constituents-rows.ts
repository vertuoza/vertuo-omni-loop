// The rows the Constituents panel's read parses (./constituents-load.ts, PRD 1030), apart from that
// server-only module so its boundary file can name them: the members and fleets the people directory
// (../people/load.ts) reads, and is_owner()'s answer.
import { z } from 'zod';

/** A workspace_roster() row, as the people directory reads it (../people/load.ts). */
export const RosterRow = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  github_login: z.string().nullable(),
  avatar_url: z.string().nullable(),
  fleet: z.string().nullable(),
  hero: z.unknown().optional(),
});

/** A fleet, as the people directory reads it from `teams`. */
export const FleetLookRow = z.object({ name: z.string(), label: z.string(), color: z.string().nullable(), mascot: z.string().nullable() });
export const FLEET_COLUMNS = 'name, label, color, mascot';

/** What is_owner() answers. */
export const IsOwner = z.boolean();
