import { MASCOTS as LIBRARY } from '@omni/design';
import { lookOf } from '@omni/galaxy';
import { z } from 'zod';
import type { FleetRow } from '../arcade/types';
import { settled } from '../stages/settled';
import { refusalOf, type Refusal } from './refusal';

// /app/settings/fleets's four calls (PRD 400 s3). In production, the owner-only fleet functions of
// supabase/migrations/20261003090000_own_fleets.sql, called as the signed-in person: each answers the
// public.teams row it saved, or refuses (refusal.ts). In the demo, the same rules kept in memory, so
// the page can be tried with no database.

/** What the owner sets: the label, the colour, the motto, and a mascot or none. */
export interface FleetLookInput {
  label: string;
  color: string;
  motto: string;
  mascot: string | null;
}

export type Saved = { ok: true; fleet: FleetRow } | { ok: false; refusal: Refusal };

export interface FleetsPort {
  create(look: FleetLookInput): Promise<Saved>;
  /** A fleet's new look. Its name is only how it is found: it never changes. */
  update(name: string, look: FleetLookInput): Promise<Saved>;
  retire(name: string): Promise<Saved>;
  restore(name: string): Promise<Saved>;
}

/** The mascot keys an owner may pick, as fleet_mascots() lists them (s1-01): the demo's list, and the
 * page's when that function cannot be read. The one list is @omni/design's mascot library. */
export const MASCOTS: readonly string[] = LIBRARY;

/** A public.teams row, as each fleet function answers it. */
const TeamRowSchema = z.object({
  name: z.string(),
  home: z.string().nullable().optional(),
  label: z.string().optional(),
  color: z.string().optional(),
  motto: z.string().nullable().optional(),
  mascot: z.string().nullable().optional(),
  sort: z.number().optional(),
  retired_at: z.string().nullable().optional(),
});
type TeamRow = z.infer<typeof TeamRowSchema>;

/** A public.teams row as the page draws it. A field the row leaves out is left out of the look's
 * input too, so @omni/galaxy's lookOf gives it its default. */
export const fleetOfRow = ({ name, home, label, color, motto, mascot, sort, retired_at }: TeamRow): FleetRow =>
  ({ name, ...lookOf(name, {
    home: home ?? null, motto: motto ?? '', retired: Boolean(retired_at),
    ...(label === undefined ? {} : { label }), ...(color === undefined ? {} : { color }),
    ...(mascot === undefined ? {} : { mascot }), ...(sort === undefined ? {} : { sort }),
  }) });

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

const lookArgs = (look: FleetLookInput) => ({ p_label: look.label, p_color: look.color, p_motto: look.motto, p_mascot: look.mascot || null });

export function databaseFleets(db: Rpc, workspace: string): FleetsPort {
  const call = async (fn: string, args: Record<string, unknown>): Promise<Saved> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return { ok: false, refusal: refusalOf(error) };
      return { ok: true, fleet: fleetOfRow(TeamRowSchema.parse(data)) };
    } catch (err) {
      return { ok: false, refusal: refusalOf(err) };
    }
  };
  return {
    create: (look) => call('create_fleet', lookArgs(look)),
    update: (name, look) => call('update_fleet', { p_name: name, ...lookArgs(look) }),
    retire: (name) => call('retire_fleet', { p_name: name }),
    restore: (name) => call('restore_fleet', { p_name: name }),
  };
}

// ── The demo ─────────────────────────────────────────────────────────────────────

const refuse = (hint: string, message: string): Saved => ({ ok: false, refusal: refusalOf({ code: '22023', hint, message }) });
const GONE: Saved = { ok: false, refusal: refusalOf({ code: 'P0002' }) };

/** The fleet functions' checks and cleaning, as the migration's fleet_look() does them. */
function checked(look: FleetLookInput): FleetLookInput | Saved {
  const label = look.label.trim();
  const color = look.color.trim().toLowerCase();
  const motto = look.motto.trim();
  const mascot = look.mascot?.trim() || null;
  if (label.length < 1 || label.length > 12) return refuse('label', 'Label: 1 to 12 characters.');
  if (!/^#[0-9a-f]{6}$/.test(color)) return refuse('color', 'Colour: a hex colour, #rrggbb.');
  if (motto.length > 60) return refuse('motto', 'Motto: at most 60 characters.');
  if (mascot && !MASCOTS.includes(mascot)) return refuse('mascot', `Mascot: one of ${MASCOTS.join(', ')}, or none.`);
  return { label, color, motto, mascot };
}

const FULL = () => refuse('fleets', 'Fleets: at most 12 active. Retire one first.');

/** The fleet functions' rules on fleets kept in memory. */
export function demoFleetsPort(initial: FleetRow[]): FleetsPort {
  let fleets = [...initial];
  const room = () => fleets.filter((f) => !f.retired).length < 12;
  const put = (fleet: FleetRow): Saved => {
    fleets = fleets.some((f) => f.name === fleet.name) ? fleets.map((f) => (f.name === fleet.name ? fleet : f)) : [...fleets, fleet];
    return { ok: true, fleet };
  };
  const find = (name: string) => fleets.find((f) => f.name === name);
  return {
    create(input) {
      return settled(() => {
        const look = checked(input);
        if ('ok' in look) return look;
        if (!room()) return FULL();
        const base = look.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fleet';
        let name = base;
        for (let n = 2; find(name); n++) name = `${base}-${n}`;
        const sort = Math.max(0, ...fleets.map((f) => f.sort)) + 10;
        return put({ name, home: null, ...look, sort, retired: false });
      });
    },
    update(name, input) {
      return settled(() => {
        const look = checked(input);
        if ('ok' in look) return look;
        const f = find(name);
        return f ? put({ ...f, ...look }) : GONE;
      });
    },
    retire(name) {
      return settled(() => {
        const f = find(name);
        return f ? put({ ...f, retired: true }) : GONE;
      });
    },
    restore(name) {
      return settled(() => {
        const f = find(name);
        if (!f) return GONE;
        if (!f.retired) return { ok: true, fleet: f };
        return room() ? put({ ...f, retired: false }) : FULL();
      });
    },
  };
}
