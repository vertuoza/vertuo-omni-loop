// The package's contract as the arcade reads it. The shapes live in types.ts; the declarations below
// stand for the typed sources so the arcade's type check never compiles the game it imports, and
// contract.test.ts proves the sources still match them.
import type {
  FleetConfig, FleetLook, GalaxyView, LedgerEvent, PlanetState, Projects, WoundKind, XpRow, XpRules,
} from './types.ts';

export type * from './types.ts';

export function buildGalaxy(events: LedgerEvent[], o: { projects: Projects; now?: Date; source?: string }): GalaxyView;
export function demoEvents(now?: Date): LedgerEvent[];
export function demoSnapshot(now?: Date): unknown;
export const DEMO_PROJECTS: Projects;
export function lookOf(name: string, fleet?: FleetConfig): FleetLook;
export const WOUND_LABEL: Record<WoundKind, string>;
export const STATE_LABEL: Record<PlanetState, string>;

export const XP_RULES: XpRules;
export function experience(events: LedgerEvent[], o: { now: Date; rules?: XpRules }): Record<string, number>;
export function levelFor(xp: number, rules?: XpRules): number;
export function xpForLevel(level: number, rules?: XpRules): number;
export function unlockedFor(level: number, stored?: readonly string[], rules?: XpRules): string[];
export function playerXp(events: LedgerEvent[], o: { now: Date; rules?: XpRules; stored?: Record<string, readonly string[]> }): XpRow[];
export function borrowedXp(events: LedgerEvent[], o: { now: Date; rules?: XpRules }): XpRow | null;
