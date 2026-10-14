import { describe, expect, it, vi } from 'vitest';
import type { GalaxyView, LedgerEvent } from '@omni/galaxy';

// #1800: Next's data cache refuses an entry over 2 MB ("items over 2MB can not be cached") and keeps
// nothing, so a season grown past it was folded from the whole ledger on every page view. The value
// the season cache hands Next stays under the limit, and the season reads back as it was folded.

const LIMIT = 2 * 1024 * 1024;
const stored: unknown[] = [];
/** An entry already in the cache under the key: returned as it is, without computing. */
let kept: { value: unknown } | null = null;

vi.mock('server-only', () => ({}));
// Next's unstable_cache, as far as the season cache sees it: the value compute returns is the entry it stores.
vi.mock('next/cache', () => ({
  unstable_cache: (compute: () => Promise<unknown>) => async () => {
    if (kept) return kept.value;
    const value = await compute();
    stored.push(value);
    return value;
  },
}));

const { LEDGER, nextCache, SEASON } = await import('./season-cache');

/** A season the size production's reached: 306 planets, each with its log and open wounds. */
function grownSeason(): GalaxyView {
  const planets = Array.from({ length: 306 }, (_, p) => ({
    prd: 100 + p,
    key: `vertuoza/vertuo-omni-loop#${String(100 + p)}`,
    title: `Planet ${String(p)}: a PRD title of a few words`,
    log: Array.from({ length: 50 }, (_, e) => ({
      id: `planet:${String(100 + p)}:${String(e)}:${(p * 7919 + e * 104729).toString(36)}`,
      at: new Date(Date.UTC(2026, 8, 1, 0, p * 13 + e * 17)).toISOString(),
      type: ['PLANET_CHARTED', 'ZONE_OPENED', 'ZONE_SECURED', 'WOUND_OPENED', 'WOUND_HEALED'][e % 5],
      contributor: `member-${String((p + e) % 23)}`,
      points: (p * e) % 97,
    })),
    openWounds: Array.from({ length: 12 }, (_, w) => ({
      id: `wound:${String(100 + p)}:${String(w)}`, openedAt: new Date(Date.UTC(2026, 9, 1, w, p)).toISOString(), ageTranches: (p + w) % 40,
    })),
  }));
  return { source: 'supabase', planets, teams: [], sectors: [], heroes: [], feed: [] } as unknown as GalaxyView;
}

describe('the season in Next\'s data cache', () => {
  it('stores a season grown past 2 MB as an entry under the limit, and reads it back as folded', async () => {
    const season = grownSeason();
    expect(JSON.stringify(season).length).toBeGreaterThan(LIMIT);
    stored.length = 0;
    const read = await nextCache(['season', 'test'], () => Promise.resolve(season), SEASON);
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0]).length).toBeLessThan(LIMIT);
    expect(read).toEqual(season);
  });

  it('reads a whole season back from the stored entry, folding it once', async () => {
    const season = { ...grownSeason(), generatedAt: '2026-10-13T09:00:00Z', season: 'S1', totals: { planets: 306, terraformed: 0, openWounds: 0, inDistress: 0, events: 0 }, rules: {} } as unknown as GalaxyView;
    const compute = vi.fn(() => Promise.resolve(season));
    stored.length = 0;
    const read = await nextCache(['season', 'whole'], compute, SEASON);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(typeof stored[0]).toBe('string');
    expect(read).toEqual(season);
    expect(read).not.toBe(season);
  });

  it('folds the season again when the stored entry holds no season', async () => {
    const notASeason = { planets: 'none' } as unknown as GalaxyView;
    const season = { ...grownSeason(), generatedAt: '2026-10-13T09:00:00Z', season: 'S1', totals: {}, rules: {} } as unknown as GalaxyView;
    const compute = vi.fn().mockResolvedValueOnce(notASeason).mockResolvedValueOnce(season);
    const read = await nextCache(['season', 'broken'], compute, SEASON);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(read).toBe(season);
  });

  it('folds the season again when the entry was stored before seasons were packed, or does not unpack', async () => {
    const season = { ...grownSeason(), generatedAt: '2026-10-13T09:00:00Z', season: 'S1', totals: {}, rules: {} } as unknown as GalaxyView;
    for (const old of [{ planets: [], source: 'supabase' }, 'not gzip at all', null]) {
      kept = { value: old };
      try {
        const compute = vi.fn(() => Promise.resolve(season));
        expect(await nextCache(['season', 'old'], compute, SEASON)).toBe(season);
        expect(compute).toHaveBeenCalledTimes(1);
      } finally {
        kept = null;
      }
    }
  });

  it('stores the read ledger of a workspace twice production\'s (#1844) as an entry well under the limit', async () => {
    // Production's ledger on 2026-10-13: 10,571 events, 2.9 MB of JSON, 284 kB packed.
    const kinds = ['PLANET_CHARTED', 'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'WOUND_OPENED', 'WOUND_CLOSED'];
    const events: LedgerEvent[] = Array.from({ length: 21_000 }, (_, i) => ({
      id: `planet:${String(100 + (i % 900))}:${(i * 2654435761).toString(36)}`,
      at: new Date(Date.UTC(2026, 6, 1) + i * 97_000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      type: kinds[i % kinds.length] ?? 'PLANET_CHARTED',
      planet: 100 + (i % 900),
      home: 'vertuoza/vertuo-omni-loop',
      contributor: `member-${String(i % 23)}`,
      data: { title: `Planet ${String(i % 900)}: a PRD title of a few words`, zone: `s${String(i % 9)}`, pr: 1000 + (i % 4000) },
    }));
    const ledger = { events, tail: { id: events.at(-1)?.id ?? '', at: '2026-10-13T09:00:00.123456+00:00' } };
    stored.length = 0;
    const read = await nextCache(['season-ledger', 'test'], () => Promise.resolve(ledger), LEDGER);
    expect(JSON.stringify(stored[0]).length).toBeLessThan(LIMIT / 2);
    expect(read).toEqual(ledger);
  });

  it('reads the whole ledger again when the stored entry holds no read ledger', async () => {
    const ledger = { events: [], tail: null };
    for (const old of [{ events: 'none', tail: null }, { events: [], tail: { id: 1 } }, { tail: null }, 'not gzip at all']) {
      kept = { value: old };
      try {
        const compute = vi.fn(() => Promise.resolve(ledger));
        expect(await nextCache(['season-ledger', 'old'], compute, LEDGER)).toBe(ledger);
        expect(compute).toHaveBeenCalledTimes(1);
      } finally {
        kept = null;
      }
    }
  });
});
