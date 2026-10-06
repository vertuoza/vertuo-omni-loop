import type { Season } from '../types.ts';

export function renderRankings(s: Pick<Season, 'season' | 'generatedAt' | 'teams' | 'individuals' | 'planets'> & { streaks?: Season['streaks'] }): string {
  const desc = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const teams = desc(s.teams).map(([t, p], i) => `| ${i + 1} | ${t} | ${p} | ${s.streaks?.[t] ? `🔥${s.streaks[t]}` : '—'} |`);
  const heroes = desc(s.individuals).map(([h, p], i) => `| ${i + 1} | @${h} | ${p} |`);
  const planets = Object.entries(s.planets).map(([prd, p]) => `| #${prd} | ${p.ownerTeam ?? '—'} | ${p.lost ? '💀 lost' : p.terraformed ? '✅ terraformed' : '🌍 terraforming'} | ${p.earned} |`);
  return [
    `## OMNI PLAN — season ${s.season}`, '', `_as of ${s.generatedAt}_`, '',
    '### Fleets', '| # | team | points | streak |', '|---|------|-------:|-------:|', ...teams, '',
    '### Heroes', '| # | hero | points |', '|---|------|-------:|', ...heroes, '',
    '### Planets', '| planet | crew | state | points on it |', '|--------|------|-------|-------------:|', ...planets,
  ].join('\n');
}
