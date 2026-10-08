// The game's own shapes, built inside it (PRD 725, s15): the world snapshot sources/github.ts reads,
// the planet planet-state.ts derives from it, and the season economy.ts folds. Nothing here is read
// from outside as it stands: what is read from GitHub or Supabase passes a schema first, in the module
// that reads it.
import type { IssueNumber, PrdNumber, PrNumber } from '../kit/lib/ids.ts';

/** A region's feature PR, or a planet's, aggregated over its regions. */
export type FeaturePr = {
  repo: string;
  number: PrNumber;
  createdAt: string | null;
  readyAt: string | null;
  mergedAt: string | null;
  // Once merged: who merged it, and who approved it, its author aside (lower-case logins, no bots).
  mergedBy?: string | null;
  approvedBy?: string[];
  lastActivityAt: string | null;
};

/** One repository a PRD lands in. */
export type Region = { repo: string; blockedBy: PrdNumber[]; surveyedAt: string | null; featurePr: FeaturePr | null };

/** When `omni:needs-fix` was put on a sub-PR and taken off it. */
export type NeedsFix = { labeledAt: string | null; unlabeledAt: string | null };

/** The sub-PR that stands for a zone. */
export type ZonePr = {
  number: PrNumber;
  author: string | null;
  createdAt: string;
  labels: string[];
  mergedAt: string | null;
  revertedAt: string | null;
  needsFix?: NeedsFix | null;
};

/** One slice of a PRD's plan, as a zone of its planet. */
export type SnapshotZone = { id: string; repo: string; wave: number; blockedBy: string[]; pr: ZonePr | null };

/** How an outbox item was settled. */
export type Settled = {
  verdict: string | null;
  at: string;
  by: string | null;
  reworkMergedAt?: string | null;
  reworkBy?: string | null;
};

/** One outbox item of a PRD, open or settled. */
export type OutboxEntry = { id: string; repo: string; rank: string; raisedAt: string; settled: Settled | null };

/** A bug naming a PRD. */
export type Bug = {
  repo: string;
  number: IssueNumber;
  createdAt: string;
  closedAt: string | null;
  closedBy?: string | null;
  fixedBy: string | null;
};

/** A PRD issue as the snapshot reads it. */
export type SnapshotPlanet = {
  prd: PrdNumber;
  home?: string | null;
  title: string;
  captain: string | null;
  ownerTeam: string | null;
  issue: { createdAt: string | null; closedAt: string | null };
  regions: Region[];
  featurePr: FeaturePr | null;
  zones: SnapshotZone[];
  outbox: OutboxEntry[];
  bugs: Bug[];
};

/** The world at one moment: every planet, and the roster (lower-cased login → fleet). */
export type Snapshot = { at: string; teams: Record<string, string>; planets: SnapshotPlanet[] };

export type DerivedZoneState = 'sealed' | 'secured' | 'under-fire' | 'claimed' | 'open';

/** A zone's state, derived from its sub-PR. */
export type DerivedZone = {
  id: string;
  repo: string;
  wave: number;
  state: DerivedZoneState;
  openedAt: string | null;
  claimedAt: string | null;
  securedAt: string | null;
  revertedAt: string | null;
  author: string | null;
};

/** A wound: something open on a planet that costs its fleet while it stays open. */
export type DerivedWound = {
  id: string;
  /** Undefined for an outbox item of a rank the game gives no wound kind. */
  kind: string | undefined;
  rank?: string;
  repo: string;
  openedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  verdict?: string | null;
};

export type DerivedPlanetState =
  | 'lost' | 'decommissioned' | 'aftershock' | 'terraformed' | 'locked' | 'charted'
  | 'awaiting-command' | 'distress' | 'terraforming';

/** A planet's derived state. */
export type DerivedPlanet = {
  prd: PrdNumber;
  home: string | null;
  key: string;
  title: string;
  captain: string | null;
  ownerTeam: string | null;
  state: DerivedPlanetState;
  regions: string[];
  class: number;
  crossSector: boolean;
  zones: DerivedZone[];
  wounds: DerivedWound[];
  distressSince: string | null;
  lastActivityAt: string | null;
  threat: number;
};

/** One credit (or debit) the economy pays. */
export type Credit = {
  at: string;
  to: string | null;
  team: string | null;
  planet: number;
  home: string | null;
  key: string;
  points: number;
  reason: string;
  clawed: boolean;
  crossTeam?: boolean;
};

/** One planet's season. */
export type PlanetSeason = { ownerTeam: string | null; terraformed: boolean; lost: boolean; earned: number };

/** A season folded from the ledger. */
export type Season = {
  season: string;
  generatedAt: string;
  credits: Credit[];
  individuals: Record<string, number>;
  teams: Record<string, number>;
  planets: Record<string, PlanetSeason>;
  streaks: Record<string, number>;
};
