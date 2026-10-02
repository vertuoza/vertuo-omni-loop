import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GalaxyView } from '@omni/galaxy';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sure } from '../../arcade/sure';

vi.mock('server-only', () => ({}));

import { demoGalaxy } from '../../data/load-galaxy';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from '../../data/galaxy.fake';
import { settle, UNREADABLE, type DemoInput, type PartInput } from '../part';
import { seasonBounds } from '../season';
import { demoRankings } from './demo';
import { loadRankings, type RankingsValue } from './load';
import { GAP, rankFleets } from './rank';
import { Rankings } from './Rankings';

// The rankings (PRD 328, slice s3): every fleet the season knows, ranked with its points and yours
// marked, and the individuals around you, each by their display name. Read from the season's galaxy
// (shared by the page, read once) and the workspace's players; drawn on the server as two tables.

const NOW = new Date('2026-09-26T10:00:00Z');
const season = seasonBounds(NOW);

/** The season's galaxy, as buildGalaxy ranks it: fleets and heroes by points. */
const GALAXY = {
  teams: [
    { name: 'pirates', label: 'PIRATES', points: 2300, rank: 1 },
    { name: 'beaver', label: 'BEAVER', points: 1900, rank: 2 },
    { name: 'invincible-team', label: 'INVINCIBLE-TEAM', points: 0, rank: 3 },
  ],
  heroes: [
    { name: 'Ada-GH', team: 'pirates', points: 980, rank: 1 },
    { name: 'wile-gh', team: 'pirates', points: 870, rank: 2 },
    { name: 'otto-gh', team: 'beaver', points: 820, rank: 3 },
    { name: 'max-gh', team: 'beaver', points: 400, rank: 4 },
    { name: 'lea-gh', team: 'beaver', points: 350, rank: 5 },
    { name: 'kim-gh', team: 'pirates', points: 300, rank: 6 },
    { name: 'both-gh', team: 'beaver', points: 280, rank: 7 },
    { name: 'sam-gh', team: 'pirates', points: 120, rank: 8 },
  ],
} as unknown as GalaxyView;

function world() {
  const w = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  const input = (over: Partial<PartInput> = {}): PartInput => ({
    db: w.client(PEOPLE.both) as unknown as SupabaseClient<Database>, workspace: VERTUOZA, userId: PEOPLE.both.id,
    login: 'both-gh', team: 'beaver', now: NOW, season, galaxy: () => Promise.resolve(GALAXY), ...over,
  });
  return { w, input };
}

const errors = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('the rankings\' read', () => {
  it('ranks every fleet of the season, yours marked', async () => {
    const { input } = world();
    const r = await loadRankings(input()) as RankingsValue;
    expect(r.fleets.map((f) => [f.rank, f.label, f.points, f.yours])).toEqual([
      [1, 'PIRATES', 2300, false], [2, 'BEAVER', 1900, true], [3, 'INVINCIBLE-TEAM', 0, false],
    ]);
  });

  it('carries each fleet\'s colour and mascot, for its chip (PRD 652)', () => {
    const teams = [
      { name: 'beaver', label: 'BEAVER', color: '#8a5a2b', mascot: 'beaver', points: 1900, rank: 2 },
      { name: 'pirates', label: 'PIRATES', color: '#2fc6a4', mascot: null, points: 2300, rank: 1 },
    ];
    expect(rankFleets(teams, 'beaver').map((f) => [f.name, f.color, f.mascot])).toEqual([
      ['pirates', '#2fc6a4', null], ['beaver', '#8a5a2b', 'beaver'],
    ]);
  });

  it('shows the individuals around you, by the display names of the workspace\'s players, else by login', async () => {
    const { input } = world();
    const r = await loadRankings(input()) as RankingsValue;
    // ADA (Ada-GH, matched ignoring case) and BOTH play in Vertuoza; WILE plays in Acme only, so
    // Vertuoza's players cannot name wile-gh, and the rest never picked a name here.
    expect(r.individuals.map((row) => (row === GAP ? '⋯' : `${row.rank} ${row.name} ${row.points}${row.you ? ' ◀' : ''}`))).toEqual([
      '1 ADA 980', '2 wile-gh 870', '3 otto-gh 820', '⋯', '6 kim-gh 300', '7 BOTH 280 ◀', '8 sam-gh 120',
    ]);
    expect(r.you).toBe('ranked');
  });

  it('reads the workspace\'s players, as the signed-in person, once; and the galaxy the page shares', async () => {
    const { w, input } = world();
    const galaxy = vi.fn(() => Promise.resolve(GALAXY));
    await loadRankings(input({ galaxy }));
    expect(galaxy).toHaveBeenCalledTimes(1);
    expect(w.calls.filter((c) => c.kind === 'from')).toEqual([expect.objectContaining({ table: 'players', op: 'select', eq: { workspace_id: VERTUOZA } })]);
  });

  it('with no points this season, or no GitHub login: the top 3, and which', async () => {
    const { input } = world();
    const none = await loadRankings(input({ login: 'nobody-gh' })) as RankingsValue;
    expect([none.individuals.length, none.you]).toEqual([3, 'no-points']);
    const unlinked = await loadRankings(input({ login: null })) as RankingsValue;
    expect([unlinked.individuals.length, unlinked.you]).toEqual([3, 'no-github']);
  });

  it('with no fleet of yours (no player row): every fleet, none marked', async () => {
    const { input } = world();
    const r = await loadRankings(input({ team: null })) as RankingsValue;
    expect(r.fleets.some((f) => f.yours)).toBe(false);
  });

  it('with no fleets: no Fleets heading and no table, only the individuals', () => {
    const html = render({ ...VALUE, fleets: [] });
    expect([...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(sure(m[1], 'm[1]')))).toEqual(['Individuals · September']);
    expect(text(html)).not.toContain('Fleets');
    expect([...html.matchAll(/<table\b/g)]).toHaveLength(1);
  });

  it('when the galaxy cannot be read: unreadable, as the page settles it, and the error logged', async () => {
    const { input } = world();
    const r = await settle('the rankings', () => loadRankings(input({ galaxy: () => Promise.reject(new Error('ledger out of reach')) })));
    expect(r).toBe(UNREADABLE);
    expect(errors().join('\n')).toContain('ledger out of reach');
  });

  it('when the players cannot be read: unreadable too, and the error logged', async () => {
    const { w, input } = world();
    w.state.failOn = 'players';
    expect(await settle('the rankings', () => loadRankings(input()))).toBe(UNREADABLE);
    expect(errors().join('\n')).toContain('the rankings');
  });
});

// ── The view ──────────────────────────────────────────────────────────────────

const VALUE: RankingsValue = {
  fleets: [
    { rank: 1, name: 'octopod', label: 'OCTOPOD', points: 2300, yours: false },
    { rank: 2, name: 'beaver', label: 'BEAVER', points: 1900, yours: true },
    { rank: 3, name: 'picsou', label: 'PICSOU', points: 1400, yours: false },
  ],
  individuals: [
    { rank: 1, name: 'INKY', points: 980, you: false },
    { rank: 2, name: 'DIME', points: 870, you: false },
    { rank: 3, name: 'OTTO', points: 820, you: false },
    GAP,
    { rank: 6, name: 'MAX', points: 1300, you: false },
    { rank: 7, name: 'PIERRE', points: 1240, you: true },
    { rank: 8, name: 'LEA', points: 120, you: false },
  ],
  you: 'ranked',
};

const render = (part: RankingsValue | 'unreadable') => renderToStaticMarkup(createElement(Rankings, { part, season }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const tableOf = (html: string, title: string) => {
  const id = new RegExp(`<h2 id="([^"]+)"[^>]*>${title}</h2>`).exec(html)?.[1];
  return new RegExp(`<table [^>]*aria-labelledby="${id}"[^>]*>([\\s\\S]*?)</table>`).exec(html)?.[1] ?? '';
};
const rowsOf = (table: string) => [...table.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)].flatMap((b) => [...sure(b[1], 'b[1]').matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)]);
/** A body row as it reads, with the ask pages' visually hidden words left out. */
const seen = (row: string) => text(row.replace(/<span class="ask-sr">[\s\S]*?<\/span>/g, ''));
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';

describe('the rankings, drawn', () => {
  it('two tables under their headings, this season: Fleets · September, then Individuals · September', () => {
    const html = render(VALUE);
    expect([...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(sure(m[1], 'm[1]')))).toEqual(['Fleets · September', 'Individuals · September']);
    expect(html).not.toMatch(/<h1\b|<script|<canvas/);
  });

  it('the fleets: each with its rank, its label and its points, yours marked', () => {
    const rows = rowsOf(tableOf(render(VALUE), 'Fleets · September'));
    expect(rows.map((r) => seen(sure(r[2], 'r[2]')))).toEqual(['1 OCTOPOD 2,300', '2 BEAVER 1,900 ◀', '3 PICSOU 1,400']);
    const marked = rows.filter((r) => sure(r[1], 'r[1]').includes('aria-current="true"'));
    expect(marked.map((r) => seen(sure(r[2], 'r[2]')))).toEqual(['2 BEAVER 1,900 ◀']);
    expect(text(sure(sure(marked[0], 'marked[0]')[2], 'marked[0]![2]'))).toContain('your fleet');
  });

  it('the individuals: the top 3, ⋯ for the ranks skipped, then you and your neighbours, you marked', () => {
    const rows = rowsOf(tableOf(render(VALUE), 'Individuals · September'));
    expect(rows.map((r) => seen(sure(r[2], 'r[2]')))).toEqual(['1 INKY 980', '2 DIME 870', '3 OTTO 820', '⋯', '6 MAX 1,300', '7 PIERRE 1,240 ◀', '8 LEA 120']);
    const marked = rows.filter((r) => sure(r[1], 'r[1]').includes('aria-current="true"'));
    expect(marked.map((r) => seen(sure(r[2], 'r[2]')))).toEqual(['7 PIERRE 1,240 ◀']);
    expect(text(sure(sure(marked[0], 'marked[0]')[2], 'marked[0]![2]'))).toContain('you');
    expect(text(sure(sure(rows[3], 'rows[3]')[2], 'rows[3]![2]'))).toContain('ranks skipped');
  });

  it('the marks are read out, not drawn: the arrow is hidden from a screen reader', () => {
    const html = render(VALUE);
    expect([...html.matchAll(/<span aria-hidden="true">◀<\/span>/g)]).toHaveLength(2);
  });

  it('with no points this season: the top 3, then No points yet this season', () => {
    const html = render({ ...VALUE, individuals: VALUE.individuals.slice(0, 3), you: 'no-points' });
    const rows = rowsOf(tableOf(html, 'Individuals · September'));
    expect(rows.map((r) => seen(sure(r[2], 'r[2]')))).toEqual(['1 INKY 980', '2 DIME 870', '3 OTTO 820']);
    expect(rows.some((r) => sure(r[1], 'r[1]').includes('aria-current'))).toBe(false);
    expect(text(html.slice(html.indexOf('Individuals')))).toMatch(/OTTO 820 No points yet this season$/);
  });

  it('with nobody scored yet this season: only the line, no empty table', () => {
    const html = render({ ...VALUE, individuals: [], you: 'no-points' });
    expect(tableOf(html, 'Individuals · September')).toBe('');
    expect(text(html.slice(html.indexOf('Individuals')))).toBe('Individuals · September No points yet this season');
  });

  it('with no GitHub login: the top 3, then a link to the arcade to link it', () => {
    const html = render({ ...VALUE, individuals: VALUE.individuals.slice(0, 3), you: 'no-github' });
    expect(html.slice(html.indexOf('Individuals'))).toMatch(/<a href="\/play">Link your GitHub in the arcade<\/a>/);
    expect(html).not.toContain('No points yet this season');
  });

  it('when the galaxy cannot be read: both tables read Couldn\'t load this, and nothing else', () => {
    const html = render('unreadable');
    expect([...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(sure(m[1], 'm[1]')))).toEqual(['Fleets · September', 'Individuals · September']);
    expect(html.split(UNREADABLE_LINE)).toHaveLength(3);
    expect(html).not.toContain('<table');
  });
});

// ── The demo ──────────────────────────────────────────────────────────────────

describe('the rankings in the demo', () => {
  const demoInput = (now: Date): DemoInput => ({ now, season: seasonBounds(now), galaxy: demoGalaxy(now), login: 'dam-dev', team: null });

  it('are the demo world\'s own: whatever fleets it ranks, none marked yours (a solo *you*), and the heroes around DAM-DEV, by login', () => {
    const input = demoInput(new Date('2026-09-28T10:00:00Z'));
    const r = demoRankings(input) as RankingsValue;
    expect(r.fleets.map((f) => f.name)).toEqual(input.galaxy.teams.map((t) => t.name));
    expect(r.fleets.some((f) => f.yours)).toBe(false);
    const me = sure(input.galaxy.heroes.find((h) => h.name === 'dam-dev'), 'the item found');
    expect(me.rank).toBeGreaterThan(5);
    expect(r.individuals.filter((row) => row !== GAP && row.you)).toEqual([{ rank: me.rank, name: 'dam-dev', points: me.points, you: true }]);
    expect(r.individuals.slice(0, 4).map((row) => (row === GAP ? '⋯' : row.rank))).toEqual([1, 2, 3, '⋯']);
    expect(r.you).toBe('ranked');
  });

  it('on the season\'s first hours, before the demo world scores anything: nobody yet, and no points for you', () => {
    const r = demoRankings(demoInput(new Date('2026-10-01T01:00:00Z'))) as RankingsValue;
    expect([r.individuals, r.you]).toEqual([[], 'no-points']);
  });
});

// ── The stylesheet ────────────────────────────────────────────────────────────

describe('the rankings\' stylesheet', () => {
  const css = readFileSync(new URL('./rankings.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('sets the two tables side by side where they fit, one above the other on a phone', () => {
    expect(css).toMatch(/\.dash-rankings \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, \d+px\), 1fr\)\);/);
  });

  it('keeps a table inside its column: long names wrap rather than push the page sideways', () => {
    expect(css).toMatch(/\.dash-rank-table \{[^}]*width: 100%;/);
    expect(css).toMatch(/\.dash-rank-name \{[^}]*overflow-wrap: anywhere;/);
  });

  it('marks your rows with the ask pages\' selected colours', () => {
    expect(css).toMatch(/\.dash-rank-table tr\[aria-current='true'\] td \{[^}]*background: var\(--ask-plasma-soft\);/);
  });
});
