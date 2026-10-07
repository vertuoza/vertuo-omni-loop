import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { sure } from '../arcade/test/sure';

// Each part's view, as the dashboard places it: a marker of its own, carrying what it was given, so
// these tests hold whatever the parts become (counts/ and board/ test their own views; home/ renders
// Home with the real board).
vi.mock('./counts/WaitingTile', () => ({ WaitingTile: ({ part }: { part: unknown }) => createElement('p', { 'data-part': 'waiting' }, `waiting ${JSON.stringify(part)}`) }));
vi.mock('./board/Board', () => ({
  Board: ({ board, path, query, peopleTitle, peopleNote }: Record<string, unknown>) => createElement('div', { 'data-part': 'board' },
    `board ${JSON.stringify({ board, path, query, peopleTitle })}`, peopleNote as never),
}));

import { DashboardScreen, type DashboardView } from './DashboardScreen';
import type { DashboardData } from './load';
import { seasonBounds } from './season';
import type { YouValue } from './you';

// The dashboard as the server renders it (PRD 328), to static markup, as switch/render.test.ts renders
// /app: what a person sees before any script runs, in each situation of the spec's States table.

const season = seasonBounds(new Date('2026-09-28T10:00:00Z'));
const HERO = { v: 1 as const, body: 'boy' as const, skin: 1, hair: 0, suit: 0, cape: 1 };
const PLAYER: YouValue = {
  kind: 'player', hero: HERO, fleet: { name: 'beaver', label: 'BEAVER', color: '#d08a4a', mascot: null },
  score: { points: 1240, you: { rank: 7, of: 23 }, fleet: { label: 'BEAVER', rank: 2, of: 5 } },
};
const data = (over: Partial<DashboardData> = {}): DashboardData => ({
  name: 'PIERRE', season, you: PLAYER, waiting: 'W', board: 'B', solo: false, ...over,
} as unknown as DashboardData);
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const render = (view: DashboardView, supabase: typeof SUPABASE | null = SUPABASE, signinError: string | null = null) =>
  renderToStaticMarkup(createElement(DashboardScreen, { view, supabase, signinError, query: { period: '30d' } }));
const dashboard = (over: Partial<DashboardData> = {}) => render({ kind: 'dashboard', dashboard: data(over) });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const h1s = (html: string) => [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(sure(m[1], 'm[1]')));
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';
/** The hero block alone: the board's heading says "Your fleet" too. */
const you = (html: string) => html.slice(html.indexOf('class="dash-you"'), html.indexOf('</section>', html.indexOf('class="dash-you"')));

describe('the dashboard', () => {
  it('is headed by the person\'s name: the page\'s one h1', () => {
    expect(h1s(dashboard())).toEqual(['PIERRE']);
  });

  it('draws the hero as a pixel SVG on the server, named', () => {
    const html = dashboard();
    const svg = /<svg [^>]*role="img"[^>]*aria-label="([^"]+)"[^>]*>/.exec(html);
    expect(svg?.[1]).toBe('PIERRE’s hero');
    expect(html).toMatch(/<svg [^>]*shape-rendering="crispEdges"/);
    expect(html).not.toMatch(/<canvas|<script/);
  });

  it('tints the hero in the fleet\'s colour: another fleet draws another hero', () => {
    const svgOf = (html: string) => /<svg[\s\S]*?<\/svg>/.exec(html)?.[0];
    const other = dashboard({ you: { ...PLAYER, fleet: { name: 'octopod', label: 'OCTOPOD', color: '#b07cff' } } as YouValue });
    expect(svgOf(other)).not.toBe(svgOf(dashboard()));
  });

  it('names the fleet as its chip, its mascot in its colour, then "fleet" (PRD 652)', () => {
    const html = dashboard({ you: { ...PLAYER, fleet: { name: 'beaver', label: 'BEAVER', color: '#d08a4a', mascot: 'beaver' } } as YouValue });
    expect(text(you(html))).toContain('BEAVER fleet');
    expect(you(html)).toMatch(/<p class="dash-fleet"><a class="fleet-chip is-inline" href="\/app\/fleet\?fleet=beaver" style="--fleet:#d08a4a"><span class="fleet-chip-mascot" aria-hidden="true"><svg [\s\S]*?<span class="fleet-chip-label">BEAVER<\/span><\/a> fleet<\/p>/);
  });

  it('a solo player\'s fleet line is the SOLO chip', () => {
    const html = dashboard({ you: { ...PLAYER, fleet: 'solo', score: { points: 30, you: { rank: 3, of: 4 }, fleet: null } } as YouValue });
    expect(you(html)).toContain('<span class="fleet-chip is-solo">SOLO</span>');
  });

  it('never carries a fleet colour that is not one: no stray declaration reaches the style', () => {
    const html = dashboard({ you: { ...PLAYER, fleet: { name: 'x', label: 'X', color: 'red;background:url(x)' } } as YouValue });
    expect(html).not.toContain('url(x)');
    expect(text(html)).toContain('X fleet');
  });

  it('a solo player reads SOLO where a fleet is named, and no fleet\'s place', () => {
    const html = dashboard({ you: { ...PLAYER, fleet: 'solo', score: { points: 30, you: { rank: 3, of: 4 }, fleet: null } } as YouValue });
    expect(text(you(html))).toContain('SOLO');
    expect(text(you(html))).not.toContain('fleet');
    expect(text(html)).not.toContain('UNCREWED');
    expect(html).not.toContain('--dash-fleet');
  });

  it('says the season\'s points and both places', () => {
    const t = text(dashboard());
    expect(t).toContain('1,240 pts · September season');
    expect(t).toContain('You #7 of 23 · BEAVER #2 of 5');
  });

  it('says so when you have no points yet, and shows 0 as 0', () => {
    const t = text(dashboard({ you: { ...PLAYER, score: { points: 0, you: null, fleet: { label: 'BEAVER', rank: 2, of: 5 } } } as YouValue }));
    expect(t).toContain('0 pts · September season');
    expect(t).toContain('No points yet this season · BEAVER #2 of 5');
  });

  it('leaves the fleet\'s place out when the season does not know it', () => {
    const t = text(dashboard({ you: { ...PLAYER, fleet: null, score: { points: 30, you: { rank: 3, of: 4 }, fleet: null } } as YouValue }));
    expect(t).toContain('You #3 of 4');
    expect(t).not.toContain(' · BEAVER');
    expect(text(you(dashboard({ you: { ...PLAYER, fleet: null, score: { points: 30, you: { rank: 3, of: 4 }, fleet: null } } as YouValue })))).not.toContain('fleet');
  });

  it('places the parts in the spec\'s order: the hero block, Waiting for you, then the board', () => {
    const html = dashboard();
    const at = (marker: string) => html.indexOf(marker);
    const order = ['<h1', 'data-part="waiting"', 'data-part="board"'].map(at);
    expect(order.every((n) => n >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('hands each part its own value, or unreadable, and the board Home\'s path, the query and "Your fleet"', () => {
    const t = text(dashboard({ waiting: 'unreadable', board: { n: 3 } as never }));
    expect(t).toContain('waiting "unreadable"');
    expect(t).toContain('board {"board":{"n":3},"path":"/app","query":{"period":"30d"},"peopleTitle":"Your fleet"}');
  });

  it('shows no rankings, no Outbox settled, no week and no season counts any more (PRD 572)', () => {
    const t = text(dashboard());
    for (const gone of ['rankings', 'Outbox settled', 'PRDs created', 'week']) expect(t).not.toContain(gone);
  });

  it('with a team: no line to Fleet', () => {
    expect(dashboard()).not.toContain('href="/app/fleet"');
  });

  it('solo, or with no player row: a line linking to the Fleet page, under the People table', () => {
    const html = dashboard({ solo: true });
    expect(html).toMatch(/<a href="\/app\/fleet">See a fleet’s board on Fleet<\/a>/);
    expect(html.indexOf('href="/app/fleet"')).toBeGreaterThan(html.indexOf('data-part="board"'));
  });

  it('draws no section cards: the sidebar leads to every section (PRD 438)', () => {
    const html = dashboard();
    expect(html).not.toContain('dash-card');
    expect(html).not.toContain('<nav');
  });
});

describe('the dashboard, when part of it cannot be shown', () => {
  it('a player with no GitHub linked: the points and places say to link it in the arcade', () => {
    const html = dashboard({ you: { ...PLAYER, score: 'no-github' } as YouValue });
    expect(text(html)).toContain('BEAVER fleet');
    expect(text(html)).not.toContain('pts');
    expect(html).toMatch(/<a [^>]*href="\/play"[^>]*>Link your GitHub in the arcade<\/a>/);
  });

  it('the galaxy out of reach: the figures say so, and the hero, the name, the fleet and the parts stay', () => {
    const html = dashboard({ you: { ...PLAYER, score: 'unreadable' } as YouValue });
    expect(text(html)).toContain(UNREADABLE_LINE);
    expect(h1s(html)).toEqual(['PIERRE']);
    expect(html).toContain('<svg');
    expect(text(html)).toContain('BEAVER fleet');
    expect(html).toContain('data-part="board"');
  });

  it('the hero block out of reach: the name heads it, it says so, and the rest renders', () => {
    const html = dashboard({ name: 'Pierre', you: 'unreadable' });
    expect(h1s(html)).toEqual(['Pierre']);
    expect(text(html)).toContain(UNREADABLE_LINE);
    expect(html).not.toContain('<svg');
    expect(html).toContain('data-part="waiting"');
    expect(html).toContain('data-part="board"');
  });

  it('a member who never played: the card that sends them to the arcade, in place of the hero block, never asking for a fleet', () => {
    const html = dashboard({ name: 'Pierre', you: { kind: 'no-player' } });
    expect(h1s(html)).toEqual(['Pierre']);
    expect(html).toMatch(/<a [^>]*href="\/play"[^>]*>Play in the arcade to get your hero and your score<\/a>/);
    expect(text(html)).not.toMatch(/join a fleet/i);
    expect(html).not.toContain('<svg');
    expect(text(html)).not.toContain('pts');
    for (const part of ['waiting', 'board']) expect(html).toContain(`data-part="${part}"`);
  });
});

describe('the other situations', () => {
  it('signed out: the sign-in card and nothing else', () => {
    const html = render({ kind: 'sign-in' });
    expect(h1s(html)).toEqual(['Sign in to see your dashboard']);
    expect(html).toMatch(/<button type="button" class="ask-button">Sign in with GitHub<\/button>/);
    expect(html).not.toContain('dash-cards');
    expect(html).not.toContain('data-part');
    expect(html.match(/<section\b/g)).toHaveLength(1);
  });

  it('signed out after a refused sign-in: the card says why', () => {
    expect(render({ kind: 'sign-in' }, SUPABASE, 'Not allowed')).toMatch(/<p class="ask-error" role="alert">Not allowed<\/p>/);
  });

  it('signed in, in no workspace: the notice, with a way to switch account, and nothing else', () => {
    const html = render({ kind: 'no-workspace' });
    expect(h1s(html)).toEqual(['Your account is not in a workspace']);
    expect(html).toMatch(/<button type="button" class="ask-button quiet"[^>]*>Sign in with another account<\/button>/);
    expect(html).not.toContain('dash-cards');
  });

  it('a deployment with no database: the notice and nothing else, no section cards', () => {
    const html = render({ kind: 'closed' }, null);
    expect(h1s(html)).toEqual(['The dashboard is not open here']);
    expect(html).not.toContain('dash-card');
    expect(html).not.toContain('data-part');
  });

  it('signed out on a deployment that cannot sign anyone in: the closed notice, never a dead button', () => {
    expect(h1s(render({ kind: 'sign-in' }, null))).toEqual(['The dashboard is not open here']);
  });
});

describe('the stylesheet', () => {
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
  const uncommented = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const SHEETS = ['./dashboard.css', './counts/counts.css'];

  it('composes every part\'s: it imports each part\'s stylesheet, first', () => {
    const css = uncommented(read('./dashboard.css')).trim();
    const imports = [...css.matchAll(/@import '([^']+)';/g)].map((m) => m[1]);
    expect(imports).toEqual(['./counts/counts.css']);
    expect(css.startsWith('@import')).toBe(true);
    expect(css.slice(css.lastIndexOf('@import')).split('\n').slice(1).join('\n')).not.toContain('@import');
  });

  it.each(SHEETS)('%s names no colour of its own: every colour comes from the ask pages\' tokens', (file) => {
    const css = uncommented(read(file));
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
    expect(css).not.toMatch(/:root\b/);
  });

  it('keeps no rule for the section cards, gone since PRD 438', () => {
    expect(uncommented(read('./dashboard.css'))).not.toMatch(/\.dash-cards?\b/);
  });

  it('keeps every part inside the page\'s width on a phone', () => {
    const css = uncommented(read('./dashboard.css'));
    // Full width since PRD 498: no cap, so nothing is wider than the page.
    expect(css).toMatch(/\.dash \{[^}]*width: 100%;/);
    expect(css).not.toMatch(/\.dash \{[^}]*max-width/);
    expect(css).toMatch(/\.dash > \* \{ min-width: 0; \}/);
  });
});
