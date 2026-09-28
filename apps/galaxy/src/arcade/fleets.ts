import type { PlanetState, WoundKind } from '@omni/galaxy';
import { FLEET_SPRITE, fleetSprite, heroLook, type Hero, type Tint } from '@omni/design';
import type { FleetRow } from './types';

export interface FleetLook { label: string; sprite: string; tint: Tint | null; color: string; motto: string; retired: boolean }

// The fleets come from Supabase (public.teams) or the demo; the arcade registers them once per
// render (setFleets), and every screen asks `fleet(name)` for a look. A fleet without a drawn mascot
// flies as a hero in its own colour.
let book = new Map<string, FleetRow>();
export function setFleets(fleets: FleetRow[]) { book = new Map(fleets.map((f) => [f.name, f])); }
export const allFleets = () => [...book.values()];

const looks = new Map<string, FleetLook>();
export function fleet(name: string | null | undefined): FleetLook {
  if (!name) return { label: 'UNCREWED', sprite: 'ship', tint: null, color: '#8a90d6', motto: 'No fleet has claimed this planet.', retired: false };
  const f = book.get(name);
  const key = `${name}|${f?.label}|${f?.color}|${f?.mascot}|${f?.motto}|${f?.retired}`;
  const hit = looks.get(key);
  if (hit) return hit;
  const color = f?.color ?? '#cfd4e6';
  const { sprite, tint } = fleetSprite(f?.mascot ?? null, color);
  const look = { label: f?.label ?? name.toUpperCase(), sprite, tint, color, motto: f?.motto ?? '', retired: f?.retired ?? false };
  looks.set(key, look);
  return look;
}

/** How a player with no fleet reads (PRD 400): SOLO, in the arcade's neutral colour. */
export const SOLO: FleetLook = Object.freeze({ label: 'SOLO', sprite: 'ship', tint: null, color: '#8a90d6', motto: 'Flies alone. Every point is your own.', retired: false });

/**
 * A player's fleet look: their fleet's, or SOLO when they fly alone. A planet nobody owns stays
 * UNCREWED (`fleet(null)`): only a player is solo.
 */
export const crewLook = (team: string | null | undefined): FleetLook => (team ? fleet(team) : SOLO);

/** A player's hero, in their fleet's colour (SOLO's when they have none). */
export const heroOf = (hero: Hero, team: string | null | undefined) => heroLook(hero, crewLook(team).color);

/**
 * The mascot library, one of each drawn mascot: the parade the "raise your own" screen marches
 * across when a workspace has no fleets yet.
 */
export const MASCOTS: readonly string[] = [...new Set(Object.values(FLEET_SPRITE) as string[])];

// A state's and a wound's colour, as the DOM panels write it: a theme token's custom property where
// the colour is one (theme.ts), so a workspace's theme recolours it.
export const STATE_LOOK: Record<PlanetState, { label: string; color: string; blink?: boolean }> = {
  charted: { label: 'CHARTED', color: 'var(--dim)' },
  locked: { label: 'LOCKED', color: '#8a8aa6' },
  terraforming: { label: 'TERRAFORMING', color: 'var(--cyan)' },
  distress: { label: 'DISTRESS', color: 'var(--red)', blink: true },
  'awaiting-command': { label: 'AWAITING COMMAND', color: 'var(--yellow)' },
  terraformed: { label: 'TERRAFORMED', color: 'var(--green)' },
  aftershock: { label: 'AFTERSHOCK', color: '#ff9b30', blink: true },
  lost: { label: 'LOST', color: '#a8183a' },
  decommissioned: { label: 'DECOMMISSIONED', color: '#5b5f80' },
};

export const WOUND_LOOK: Record<WoundKind, { name: string; color: string }> = {
  transmission: { name: 'TRANSMISSION', color: 'var(--cyan)' },
  'unconfirmed-ground': { name: 'UNCONFIRMED GROUND', color: '#ffb347' },
  beacon: { name: 'BEACON', color: 'var(--red)' },
  'fault-line': { name: 'FAULT LINE', color: 'var(--yellow)' },
  'under-fire': { name: 'ZONE UNDER FIRE', color: '#ff9b30' },
  aftershock: { name: 'AFTERSHOCK', color: 'var(--red)' },
};

export const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V'];

export function ordinal(n: number): string {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export function age(hours: number): string {
  if (hours < 1) return 'NOW';
  if (hours < 48) return `${hours}H`;
  return `${Math.round(hours / 24)}D`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// Deterministic seed per planet, so a planet's continents never change between visits.
export const seedOf = (prd: number) => (prd * 2654435761) >>> 0;
