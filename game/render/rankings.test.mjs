import { describe, it, expect } from 'vitest';
import { renderRankings } from './rankings.mjs';

describe('renderRankings', () => {
  it('lists teams then individuals, highest first', () => {
    const md = renderRankings({ season: '2026-09', generatedAt: '2026-09-28T07:00:00Z', individuals: { alice: 60, pm: 30 }, teams: { octopod: 60, beaver: 127.5 }, streaks: { beaver: 2 }, planets: { 2332: { ownerTeam: 'beaver', terraformed: true, lost: false, earned: 217.5 } } });
    expect(md).toBe([
      '## OMNI PLAN — season 2026-09',
      '',
      '_as of 2026-09-28T07:00:00Z_',
      '',
      '### Fleets',
      '| # | team | points | streak |',
      '|---|------|-------:|-------:|',
      '| 1 | beaver | 127.5 | 🔥2 |',
      '| 2 | octopod | 60 | — |',
      '',
      '### Heroes',
      '| # | hero | points |',
      '|---|------|-------:|',
      '| 1 | @alice | 60 |',
      '| 2 | @pm | 30 |',
      '',
      '### Planets',
      '| planet | crew | state | points on it |',
      '|--------|------|-------|-------------:|',
      '| #2332 | beaver | ✅ terraformed | 217.5 |',
    ].join('\n'));
  });
});
