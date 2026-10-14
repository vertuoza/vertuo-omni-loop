// PRD 1934: the model and effort a slice runs on. The plan advises a tier per slice (`deep`, `build`,
// `light`); the config's `tiers` maps each tier to a model and an effort, one row per agent. Nothing
// mapped — no `tiers`, no row for the agent, no entry for the tier, or no advice — inherits: the slice
// runs on the terminal's model, as it always did. The kit ships no mapping of its own.
import { EFFORTS, TIERS } from './config.ts';
import { isOneOf } from './narrow.ts';
import type { Agent, Config } from './types.ts';

export type Tier = (typeof TIERS)[number];
export type Effort = (typeof EFFORTS)[number];

/** A mapped tier: the model the agent runs the slice on, and its effort when the config sets one. */
export type TierModel = { model: string; effort?: Effort };

/** What a tier resolves to when nothing maps it: the terminal's own model. */
export const INHERIT = 'inherit';

/** Whether `value` is one of the three tiers. */
export function isTier(value: string): value is Tier {
  return isOneOf(TIERS, value);
}

/** The model and effort `agent` runs a slice advised `tier` on, or `inherit` when nothing maps it. */
export function resolveTier(config: Pick<Config, 'tiers'>, agent: Agent, tier: Tier | null): TierModel | typeof INHERIT {
  if (tier === null) return INHERIT;
  const entry = config.tiers?.[agent]?.[tier];
  if (entry === undefined) return INHERIT;
  return entry.effort === undefined ? { model: entry.model } : { model: entry.model, effort: entry.effort };
}
