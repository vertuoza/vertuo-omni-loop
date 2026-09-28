import { describe, expect, it } from 'vitest';
import { GAP, rankFleets, rankingsOf, rankWindow, type WindowRow } from './rank';

// The rankings' pure functions (PRD 328): the individuals around you (rankWindow, the spec's Test
// seams), every fleet ranked with yours marked (rankFleets), and the two tables as the part shows
// them, with each hero's display name (rankingsOf).

/** A season of `n` heroes, `h1` first: each scores 10 fewer points than the one above, from 10 × n. */
const season = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `h${i + 1}`, team: null, points: 10 * (n - i), rank: i + 1 }));

/** The rows as ranks: a number per hero, `⋯` per gap, and `*` after yours. */
const ranks = (rows: WindowRow[]) => rows.map((r) => (r === GAP ? '⋯' : `${r.rank}${r.you ? '*' : ''}`));

describe('rankWindow: the individuals around you', () => {
  it('you first: ranks 1 to 5, you marked, no gap', () => {
    const w = rankWindow(season(30), 'h1');
    expect(ranks(w.rows)).toEqual(['1*', '2', '3', '4', '5']);
    expect(w.ranked).toBe(true);
  });

  it('you 4th: ranks 1 to 5, no gap', () => {
    expect(ranks(rankWindow(season(30), 'h4').rows)).toEqual(['1', '2', '3', '4*', '5']);
  });

  it('you 2nd or 3rd: ranks 1 to 5 as well', () => {
    expect(ranks(rankWindow(season(30), 'h2').rows)).toEqual(['1', '2*', '3', '4', '5']);
    expect(ranks(rankWindow(season(30), 'h3').rows)).toEqual(['1', '2', '3*', '4', '5']);
  });

  it('you 5th: 1 to 3, then 4 to 6, no gap', () => {
    expect(ranks(rankWindow(season(30), 'h5').rows)).toEqual(['1', '2', '3', '4', '5*', '6']);
  });

  it('you 6th: 1 to 3, ⋯ for rank 4 alone, then 5 to 7', () => {
    expect(ranks(rankWindow(season(30), 'h6').rows)).toEqual(['1', '2', '3', '⋯', '5', '6*', '7']);
  });

  it('you 12th of 30: 1 to 3, ⋯, 11 to 13', () => {
    const w = rankWindow(season(30), 'h12');
    expect(ranks(w.rows)).toEqual(['1', '2', '3', '⋯', '11', '12*', '13']);
    expect(w.rows.at(-2)).toEqual({ rank: 12, login: 'h12', points: 190, you: true });
  });

  it('you last: no one below you', () => {
    expect(ranks(rankWindow(season(30), 'h30').rows)).toEqual(['1', '2', '3', '⋯', '29', '30*']);
    expect(ranks(rankWindow(season(5), 'h5').rows)).toEqual(['1', '2', '3', '4', '5*']);
  });

  it('you unranked, with no points this season: the top 3, and nobody marked', () => {
    const w = rankWindow(season(30), 'nobody-gh');
    expect(ranks(w.rows)).toEqual(['1', '2', '3']);
    expect(w.ranked).toBe(false);
  });

  it('you in the ledger with 0 points: unranked, as the hero block reads it', () => {
    const heroes = [...season(4), { name: 'zero-gh', team: null, points: 0, rank: 5 }];
    const w = rankWindow(heroes, 'zero-gh');
    expect(ranks(w.rows)).toEqual(['1', '2', '3']);
    expect(w.ranked).toBe(false);
  });

  it('no GitHub login to find you by: the top 3, unranked', () => {
    const w = rankWindow(season(30), null);
    expect(ranks(w.rows)).toEqual(['1', '2', '3']);
    expect(w.ranked).toBe(false);
  });

  it('matches your login ignoring case, both ways', () => {
    const heroes = season(30).map((h) => (h.name === 'h12' ? { ...h, name: 'Ada-GH' } : h));
    expect(ranks(rankWindow(heroes, 'ada-gh').rows)).toContain('12*');
    expect(ranks(rankWindow(heroes, 'ADA-gh').rows)).toContain('12*');
  });

  it('a short season: as many as there are, and nobody at all before anyone scores', () => {
    expect(ranks(rankWindow(season(2), 'h2').rows)).toEqual(['1', '2*']);
    expect(ranks(rankWindow(season(2), 'nobody').rows)).toEqual(['1', '2']);
    expect(rankWindow([], 'h1')).toEqual({ rows: [], ranked: false });
  });

  it('reads the heroes in rank order, whatever order it is given them in', () => {
    expect(ranks(rankWindow(season(30).reverse(), 'h12').rows)).toEqual(['1', '2', '3', '⋯', '11', '12*', '13']);
  });
});

describe('rankFleets: every fleet the season knows', () => {
  const teams = [
    { name: 'beaver', label: 'BEAVER', points: 1900, rank: 2 },
    { name: 'octopod', label: 'OCTOPOD', points: 2300, rank: 1 },
    { name: 'pirates', label: 'PIRATES', points: 150, rank: 3 },
  ];

  it('ranked by points, each with its label and points, yours marked', () => {
    expect(rankFleets(teams, 'beaver')).toEqual([
      { rank: 1, name: 'octopod', label: 'OCTOPOD', points: 2300, yours: false },
      { rank: 2, name: 'beaver', label: 'BEAVER', points: 1900, yours: true },
      { rank: 3, name: 'pirates', label: 'PIRATES', points: 150, yours: false },
    ]);
  });

  it('marks none with no fleet of yours, or one the season does not know', () => {
    expect(rankFleets(teams, null).some((f) => f.yours)).toBe(false);
    expect(rankFleets(teams, 'invincible-team').some((f) => f.yours)).toBe(false);
  });
});

describe('rankingsOf: the two tables, as the part shows them', () => {
  const galaxy = {
    teams: [
      { name: 'octopod', label: 'OCTOPOD', points: 2300, rank: 1 },
      { name: 'beaver', label: 'BEAVER', points: 1900, rank: 2 },
    ],
    heroes: [
      { name: 'Inky-GH', team: 'octopod', points: 980, rank: 1 },
      { name: 'dime-gh', team: 'octopod', points: 870, rank: 2 },
      { name: 'otto-gh', team: 'beaver', points: 820, rank: 3 },
      { name: 'max-gh', team: 'beaver', points: 300, rank: 4 },
    ],
  };
  const crew = [
    { display_name: 'INKY', github_login: 'inky-gh' },
    { display_name: '  ', github_login: 'dime-gh' },
    { display_name: 'OTTO', github_login: null },
    { display_name: 'MAX', github_login: 'Max-GH' },
  ];

  it('names each hero by the display name of the player with that login, ignoring case, else by the login', () => {
    const r = rankingsOf(galaxy, crew, 'max-gh', 'beaver');
    expect(r.individuals.map((row) => (row === GAP ? '⋯' : row.name))).toEqual(['INKY', 'dime-gh', 'otto-gh', 'MAX']);
  });

  it('marks your fleet and your row, and says you rank', () => {
    const r = rankingsOf(galaxy, crew, 'max-gh', 'beaver');
    expect(r.fleets.find((f) => f.yours)?.name).toBe('beaver');
    expect(r.individuals.filter((row) => row !== GAP && row.you)).toEqual([{ rank: 4, name: 'MAX', points: 300, you: true }]);
    expect(r.you).toBe('ranked');
  });

  it('with no points this season: the top 3, and says so', () => {
    const r = rankingsOf(galaxy, crew, 'lea-gh', 'beaver');
    expect(r.individuals).toHaveLength(3);
    expect(r.you).toBe('no-points');
  });

  it('with no GitHub login: the top 3, and a way to link it', () => {
    const r = rankingsOf(galaxy, crew, null, 'beaver');
    expect(r.individuals).toHaveLength(3);
    expect(r.you).toBe('no-github');
    expect(r.fleets.find((f) => f.yours)?.name).toBe('beaver');
  });
});
