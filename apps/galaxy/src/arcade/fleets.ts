import type { PlanetState, WoundKind } from '@omni/galaxy';

export interface FleetLook { label: string; sprite: string; color: string; motto: string }

// Team names match the GitHub teams in projects.yml. An unknown team still gets a ship.
export const FLEETS: Record<string, FleetLook> = {
  beaver: { label: 'BEAVER', sprite: 'beaver', color: '#d08a4a', motto: 'Builds the dam. Secures the zone.' },
  octopod: { label: 'OCTOPOD', sprite: 'octopod', color: '#b07cff', motto: 'Eight arms, eight sub-PRs.' },
  picsou: { label: 'PICSOU', sprite: 'picsou', color: '#ffd84a', motto: 'Every coin counted twice.' },
  cia: { label: 'C.I.A.', sprite: 'cia', color: '#9aa3c8', motto: 'Knows every open question.' },
  'invincible-team': { label: 'INVINCIBLE', sprite: 'invincible', color: '#4fb0ff', motto: 'Think, Mark. Then ship it.' },
};

export function fleet(name: string | null | undefined): FleetLook {
  if (!name) return { label: 'UNCREWED', sprite: 'ship', color: '#8a90d6', motto: 'No fleet has claimed this planet.' };
  return FLEETS[name] ?? { label: name.toUpperCase(), sprite: 'ship', color: '#cfd4e6', motto: '' };
}

export const STATE_LOOK: Record<PlanetState, { label: string; color: string; blink?: boolean }> = {
  charted: { label: 'CHARTED', color: '#8a90d6' },
  locked: { label: 'LOCKED', color: '#8a8aa6' },
  terraforming: { label: 'TERRAFORMING', color: '#6ff0ff' },
  distress: { label: 'DISTRESS', color: '#ff3b5c', blink: true },
  'awaiting-command': { label: 'AWAITING COMMAND', color: '#ffd84a' },
  terraformed: { label: 'TERRAFORMED', color: '#4ee08a' },
  aftershock: { label: 'AFTERSHOCK', color: '#ff9b30', blink: true },
  lost: { label: 'LOST', color: '#a8183a' },
  decommissioned: { label: 'DECOMMISSIONED', color: '#5b5f80' },
};

export const WOUND_LOOK: Record<WoundKind, { name: string; color: string }> = {
  transmission: { name: 'TRANSMISSION', color: '#6ff0ff' },
  'unconfirmed-ground': { name: 'UNCONFIRMED GROUND', color: '#ffb347' },
  beacon: { name: 'BEACON', color: '#ff3b5c' },
  'fault-line': { name: 'FAULT LINE', color: '#ffd84a' },
  'under-fire': { name: 'ZONE UNDER FIRE', color: '#ff9b30' },
  aftershock: { name: 'AFTERSHOCK', color: '#ff3b5c' },
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
