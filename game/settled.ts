// The planets the ledger already holds as finished, which game:project reads light: no plan, no
// zones, no outbox, no timelines. A planet is settled when the ledger holds its PLANET_TERRAFORMED and
// a FEATURE_MERGED (the PR number its light read carries), and every wound opened on it has closed.
// Nothing a full read would add can change then, except an aftershock: a bug naming the PRD opened in
// the aftershock window after the merge. So a settled planet still reads its bugs while that window
// is open, and the first WOUND_OPENED it adds unsettles it: the next poll reads it in full again.
import { RULEBOOK } from './rulebook.ts';
import { planetKeyOf, type GameEvent } from './events.ts';
import { PrNumberSchema, type PrNumber } from '../kit/lib/ids.ts';

/** What a settled planet's light read needs: its merge, its feature PR, and whether bugs still matter. */
export type SettledPlanet = { mergedAt: string; repo: string; pr: PrNumber; readBugs: boolean };

const DAY_MS = 86_400_000;

// Keyed by planet key, `<home>#<n>`. Rows written before PRD 728 have no home and settle nothing.
export function settledPlanets(events: readonly GameEvent[], now: Date): Map<string, SettledPlanet> {
  const terraformedAt = new Map<string, string>();
  const merges = new Map<string, { repo: string; pr: PrNumber }>();
  const opened = new Map<string, Set<string>>(); // planet key → its wounds' ids, without `:opened`
  const closed = new Set<string>();
  for (const e of events) {
    if (!e.home) continue;
    const key = planetKeyOf(e);
    if (e.type === 'PLANET_TERRAFORMED') terraformedAt.set(key, e.at);
    else if (e.type === 'FEATURE_MERGED') {
      const pr = PrNumberSchema.safeParse(e.data.pr);
      const repo = e.region ?? e.home;
      // The home's feature PR stands for the planet when there is one, as it is the first region.
      if (pr.success && (!merges.has(key) || repo === e.home)) merges.set(key, { repo, pr: pr.data });
    } else if (e.type === 'WOUND_OPENED') opened.set(key, (opened.get(key) ?? new Set()).add(e.id.replace(/:opened$/, '')));
    else if (e.type === 'WOUND_CLOSED') closed.add(e.id.replace(/:closed$/, ''));
  }
  const settled = new Map<string, SettledPlanet>();
  for (const [key, mergedAt] of terraformedAt) {
    const merge = merges.get(key);
    if (!merge || [...(opened.get(key) ?? [])].some((wound) => !closed.has(wound))) continue;
    const readBugs = now.getTime() - Date.parse(mergedAt) <= RULEBOOK.aftershockWindowDays * DAY_MS;
    settled.set(key, { mergedAt, ...merge, readBugs });
  }
  return settled;
}
