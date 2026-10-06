import { describe, expect, it } from 'vitest';
import { inSeason, seasonBounds } from './season';
import { twinEvents, twinGalaxy, TWIN_NOW } from '../arcade/test/twins.fake';

// The season (PRD 328): the calendar month in UTC, the one the game's economy scores (buildGalaxy
// scores `now.toISOString().slice(0, 7)`). The points, both rankings and the three season counts all
// read within these bounds, so they reset together.

const at = (iso: string) => new Date(iso);

describe('seasonBounds', () => {
  it('is the UTC month now is in: from its 1st at 00:00 UTC, up to the next month\'s', () => {
    const season = seasonBounds(at('2026-09-28T10:00:00Z'));
    expect(season.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(season.to.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(season.name).toBe('September');
  });

  it('starts at 00:00 UTC on the 1st: that instant is the new season\'s', () => {
    const season = seasonBounds(at('2026-10-01T00:00:00Z'));
    expect(season.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(season.name).toBe('October');
  });

  it('ends just before: the last millisecond of the month is still its season', () => {
    const season = seasonBounds(at('2026-09-30T23:59:59.999Z'));
    expect(season.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(season.to.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('reads UTC, not Brussels: 01:30 in Brussels on the 1st is still the month before', () => {
    // 2026-10-01T01:30+02:00 is 2026-09-30T23:30Z.
    expect(seasonBounds(at('2026-10-01T01:30:00+02:00')).name).toBe('September');
  });

  it('turns the year in December', () => {
    const season = seasonBounds(at('2026-12-15T12:00:00Z'));
    expect(season.from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(season.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(season.name).toBe('December');
  });

  it('keys the season as the economy does', () => {
    const now = at('2026-09-28T10:00:00Z');
    expect(seasonBounds(now).key).toBe(now.toISOString().slice(0, 7));
  });

  it('holds an instant when from <= it < to, and none outside', () => {
    const season = seasonBounds(at('2026-09-15T00:00:00Z'));
    const holds = (instant: string) => inSeason(season, instant);
    expect(holds('2026-09-01T00:00:00Z')).toBe(true);
    expect(inSeason(season, at('2026-09-01T00:00:00Z'))).toBe(true);
    expect(holds('2026-09-30T23:59:59Z')).toBe(true);
    expect(holds('2026-08-31T23:59:59Z')).toBe(false);
    expect(holds('2026-10-01T00:00:00Z')).toBe(false);
  });
});

// PRD 728: the economy keys a planet by `<home>#<n>`. The dashboard's Points column reads the
// galaxy's heroes, which the economy scores for this season's key.
describe('the season the Points column reads', () => {
  it('is the galaxy\'s: the economy scores the season seasonBounds keys', () => {
    expect(twinGalaxy().season).toBe(seasonBounds(TWIN_NOW).key);
  });

  it('pays each of two repositories\' PRD 88 to its own crew, and nothing from the season before', () => {
    const last = twinEvents('acme/plan', 'beaver', 'carol', 70).map((e) => ({ ...e, at: e.at.replace('2026-09-', '2026-08-') }));
    const view = twinGalaxy([...twinEvents('acme/plan', 'beaver', 'bob'), ...twinEvents('acme/tools', 'octopod', 'alice'), ...last]);
    expect(Object.fromEntries(view.heroes.map((h) => [h.name, h.points]))).toEqual({ alice: 10, bob: 10 });
    expect(view.planets.filter((p) => p.prd === 88).map((p) => [p.key, p.earned])).toEqual([['acme/plan#88', 10], ['acme/tools#88', 10]]);
  });
});
