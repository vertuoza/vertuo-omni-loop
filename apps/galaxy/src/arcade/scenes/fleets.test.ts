import { beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildGalaxy, demoEvents, DEMO_PROJECTS, lookOf, type Fleet, type GalaxyView } from '@omni/galaxy';
import { gridFor } from '../grid';
import { ScreenContext } from '../Screen';
import { fleet, setFleets } from '../fleets';
import type { FleetRow } from '../types';
import { TALL, WIDE, type Grid } from './common.ts';
import { cardsShown, TALL_SCENES } from './fleets.ts';
import { FleetsOverlay } from './fleets.tsx';

const now = new Date('2026-09-25T10:00:00Z');
const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });
const fleets: FleetRow[] = Object.entries(DEMO_PROJECTS.teams).map(([name, t]) => ({ name, ...lookOf(name, t) }));

/** The demo galaxy with `extra` more fleets on the wall, each with a crew of its own. */
function withMoreFleets(extra: number): GalaxyView {
  const more: Fleet[] = Array.from({ length: extra }, (_, i) => ({
    ...view.teams[i % view.teams.length]!, name: `extra-${i}`, rank: view.teams.length + i + 1, points: 40 - i,
    streak: i + 7, planets: i + 1, terraformed: 0, members: [`crew-${i}-a`, `crew-${i}-b`],
  }));
  return { ...view, teams: [...view.teams, ...more] };
}

/** The fleets wall's text layer on `grid`, with fleet `index` selected. */
function wall(grid: Grid, index: number, at: GalaxyView = view) {
  return renderToStaticMarkup(createElement(
    ScreenContext.Provider,
    { value: { form: grid === TALL ? 'handheld' : 'full', grid, page: 0, pages: 1 } },
    createElement(FleetsOverlay, { view: at, crew: [], index, onPick: () => {} }),
  ));
}

/** The cards on the wall: each one's label and season points, in order. */
const cardsIn = (html: string) => [...html.matchAll(/<span class="card-name">([^<]*)<\/span><span class="card-pts">([^<]*)<\/span>/g)]
  .map(([, label, points]) => ({ label, points: Number(points) }));
const unescape = (html: string) => html.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe('the fleets wall on the tall grid', () => {
  beforeAll(() => { setFleets(fleets); });

  it('is listed as tall: the Game Boy held upright draws it on the tall grid, every other form on the wide one', () => {
    expect(TALL_SCENES).toContain('fleets');
    expect(gridFor('handheld', 'fleets')).toBe(TALL);
    expect(gridFor('advance', 'fleets')).toBe(WIDE);
    expect(gridFor('full', 'fleets')).toBe(WIDE);
  });

  it('reaches every fleet, each with its season points, streak, planets and crew', () => {
    view.teams.forEach((team, i) => {
      const html = unescape(wall(TALL, i));
      expect(cardsIn(html)).toContainEqual({ label: fleet(team.name).label, points: team.points });
      expect(html).toContain(`<dt>STREAK</dt><dd>${team.streak}</dd>`);
      expect(html).toContain(`<dd>${team.planets} OWNED · ${team.terraformed} DONE</dd>`);
      for (const login of team.members) expect(html).toContain(`@${login}`);
    });
  });

  it('shows every card at once while five fit across it, as the wide wall does', () => {
    const shown = cardsIn(wall(TALL, 0));
    expect(shown.map((c) => c.label)).toEqual(view.teams.map((t) => fleet(t.name).label));
    expect(wall(TALL, 0)).not.toContain('cards-page');
  });

  it('splits more fleets than fit into pages, and shows the page of the selected fleet', () => {
    const at = withMoreFleets(3);
    const seen = new Set<string>();
    at.teams.forEach((team, i) => {
      const html = unescape(wall(TALL, i, at));
      const cards = cardsIn(html);
      expect(cards.length).toBeLessThanOrEqual(5);
      expect(cards).toContainEqual({ label: fleet(team.name).label, points: team.points });
      expect(html).toContain(`<dt>STREAK</dt><dd>${team.streak}</dd>`);
      for (const login of team.members) expect(html).toContain(`@${login}`);
      expect(html).toMatch(/class="cards-page">[12]\/2</);
      for (const c of cards) seen.add(`${c.label}|${c.points}`);
    });
    expect(seen.size).toBe(at.teams.length);
  });

  it('keeps the wide wall as it is: every card at once, and no pages', () => {
    const at = withMoreFleets(3);
    expect(cardsIn(wall(WIDE, 6, at))).toHaveLength(at.teams.length);
    expect(wall(WIDE, 6, at)).not.toContain('cards-page');
  });
});

describe('cardsShown', () => {
  it('shows every card on the wide grid, however many fleets there are', () => {
    for (const count of [0, 1, 5, 9]) {
      for (let i = 0; i < count; i++) expect(cardsShown(WIDE, count, i)).toEqual({ from: 0, to: count, page: 0, pages: 1 });
    }
  });

  it('shows every card on the tall grid while five fit', () => {
    for (const count of [0, 1, 4, 5]) expect(cardsShown(TALL, count, 0)).toEqual({ from: 0, to: count, page: 0, pages: 1 });
  });

  it('splits more fleets into pages of at most five, as even as they go, each fleet on exactly one', () => {
    for (let count = 6; count <= 16; count++) {
      const pages = new Map<number, { from: number; to: number }>();
      for (let i = 0; i < count; i++) {
        const shown = cardsShown(TALL, count, i);
        expect(i, `${count} fleets, fleet ${i}`).toBeGreaterThanOrEqual(shown.from);
        expect(i, `${count} fleets, fleet ${i}`).toBeLessThan(shown.to);
        expect(shown.to - shown.from).toBeLessThanOrEqual(5);
        expect(shown.pages).toBe(Math.ceil(count / 5));
        pages.set(shown.page, shown);
      }
      const sizes = [...pages.values()].map((p) => p.to - p.from);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(count);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });
});

describe('the fleets wall with zero fleets (PRD 400)', () => {
  const none: GalaxyView = { ...view, teams: [] };
  const empty = (owner: boolean) => unescape(renderToStaticMarkup(createElement(
    ScreenContext.Provider,
    { value: { form: 'full', grid: WIDE, page: 0, pages: 1 } },
    createElement(FleetsOverlay, { view: none, crew: [], index: 0, onPick: () => {}, owner }),
  )));

  it('hides the wall and shows the "raise your own" screen instead', () => {
    const html = empty(false);
    expect(html).not.toContain('SELECT FLEET');
    expect(cardsIn(html)).toEqual([]);
    expect(html).toContain('NO FLEETS YET — RAISE YOUR OWN!');
    expect(html).toContain('ASK YOUR OWNER');
    expect(html).not.toContain('UNCREWED');
  });

  it('points the owner at /app/settings/fleets', () => {
    expect(empty(true)).toContain('SET THEM UP AT');
    expect(empty(true)).toContain('href="/app/settings/fleets"');
  });
});
