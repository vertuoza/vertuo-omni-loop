// The galaxy view's shapes (PRD 725, s23): what buildGalaxy folds ledger events into and the arcade
// draws. One source for the package's types: index.d.ts re-exports them for the arcade, and the
// sources type themselves with them. Self-contained on purpose, so the arcade's type check never
// reaches into the game's sources through it.
export type PlanetState =
  | 'charted' | 'locked' | 'terraforming' | 'distress' | 'awaiting-command'
  | 'terraformed' | 'aftershock' | 'lost' | 'decommissioned';
export type ZoneState = 'open' | 'claimed' | 'under-fire' | 'secured';
export type WoundKind = 'transmission' | 'unconfirmed-ground' | 'beacon' | 'fault-line' | 'under-fire' | 'aftershock';

export interface LedgerEvent {
  id: string; at: string; type: string; planet: number;
  /** The PRD's home, `owner/name` (PRD 728); absent on the events written before it. */
  home?: string;
  region?: string; contributor?: string; team?: string; data: Record<string, unknown>;
}
/** A fleet as stored in Supabase (public.teams). Only `home` is required; the rest has defaults. */
export interface FleetConfig {
  home: string | null; label?: string; color?: string; motto?: string; mascot?: string | null; sort?: number; retired?: boolean;
}
export interface FleetLook { home: string | null; label: string; color: string; motto: string; mascot: string | null; sort: number; retired: boolean }
export interface Projects {
  sectors: Record<string, { repos: string[] }>;
  teams: Record<string, FleetConfig>;
}
export interface Zone { id: string; region: string; wave: number | null; state: ZoneState; contributor: string | null; team: string | null; at: string | null }
export interface Wound {
  id: string; kind: WoundKind; rank: string | null; region: string | null; openedAt: string;
  closedAt: null; closedBy: null; ageTranches: number; ageHours: number; decayPerTranche: number;
}
export interface LogLine { at: string; type: string; planet: number; text: string; contributor: string | null; team: string | null }
export interface Planet {
  prd: number;
  /** The repository of the PRD's issue, `owner/name`, or null for an event written before PRD 728. */
  home: string | null;
  /** How the view names the planet: `<home>#<prd>`, or the number alone without a home. */
  key: string;
  title: string; captain: string | null; ownerTeam: string | null; state: PlanetState;
  regions: string[]; sectors: string[]; sector: string | null; crossSector: boolean; class: number;
  blockers: number[]; zones: Zone[]; secured: number; progress: number;
  openWounds: Wound[]; closedWounds: number; threat: number; distressSince: string | null;
  expeditions: string[]; rescuers: { login: string; team: string | null }[];
  chartedAt: string | null; terraformedAt: string | null; lostAt: string | null; lostReason: string | null;
  lastEventAt: string | null; earned: number; log: LogLine[];
}
export interface Fleet extends FleetLook {
  name: string; points: number; rank: number; planets: number; terraformed: number;
  inDistress: number; openWounds: number; streak: number; members: string[];
}
export interface Hero { name: string; team: string | null; points: number; rank: number }
export interface Rules {
  zoneSecured: number; woundClose: Record<WoundKind, number>; decayPerTranche: Record<WoundKind, number>;
  trancheHours: number; rescue: number; terraformOwner: number; terraformExpedition: number; terraformCloser: number;
  crossTeamMultiplier: number; nightShiftMultiplier: number; distressAfterHours: number; lostAfterDays: number;
  classMultipliers: number[];
  /** The rulebook's `xp` block, as `pnpm game:xp` applies it: what counts, the curve, the unlocks. */
  xp: XpRules;
}
export interface GalaxyView {
  generatedAt: string; season: string; source: string;
  sectors: { name: string; repos: string[]; fleets: string[] }[];
  teams: Fleet[]; heroes: Hero[]; planets: Planet[]; feed: LogLine[];
  totals: { planets: number; terraformed: number; openWounds: number; inDistress: number; events: number };
  rules: Rules;
}

/** The rulebook's `xp` block (game/rulebook.ts): every XP number, in one place. */
export interface XpRules {
  weights: Readonly<Record<'zoneSecured' | 'woundClosed' | 'rescue' | 'expedition' | 'closer', number>>;
  curve: Readonly<{ first: number; step: number }>;
  cap: number;
  /** The level each game unlocks at, by game id. */
  unlocks: Readonly<Record<string, number>>;
}
/** One login's XP, as `player_xp` holds it: level 0 is no level yet. */
export interface XpRow { login: string; xp: number; level: number; unlocked: string[] }
