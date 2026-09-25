import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { buildGalaxy, demoEvents, DEMO_PROJECTS } from '@omni/galaxy';
import { fit, frameFor, gridFor, pagesFor, TALL, TALL_SCENES, turnPage, WIDE } from './grid';
import type { SceneName } from './scenes/common.ts';

function source(path: string) {
  return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest);
}

/**
 * Every `SceneName`, read by TypeScript's own parser from where the type is declared. The type has no
 * list at run time, and a list copied here could drift: read this way, a scene added to the type is
 * a scene this file checks, with nothing here to update.
 */
function sceneNames(): SceneName[] {
  const file = source('./scenes/common.ts');
  const alias = file.statements.find((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === 'SceneName');
  if (!alias) throw new Error('scenes/common.ts no longer declares the SceneName type');
  const members = ts.isUnionTypeNode(alias.type) ? alias.type.types : [alias.type];
  return members.map((m) => {
    if (!ts.isLiteralTypeNode(m) || !ts.isStringLiteral(m.literal)) {
      throw new Error(`SceneName is no longer a union of names (${m.getText(file)}): read the scenes from where they now live`);
    }
    return m.literal.text as SceneName;
  });
}

/** The scenes the dispatcher draws: the `case` labels of `drawFrame` in `scenes/index.ts`. */
function drawnScenes(): string[] {
  const file = source('./scenes/index.ts');
  const labels: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression)) labels.push(node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return labels;
}

const SCENES = sceneNames();

describe('the two grids', () => {
  it('are 640×360 and 320×288', () => {
    expect(WIDE).toEqual({ name: 'wide', w: 640, h: 360 });
    expect(TALL).toEqual({ name: 'tall', w: 320, h: 288 });
  });
});

describe('gridFor', () => {
  const listed = new Set<SceneName>(['menu', 'map']);

  it('gives the wide grid on full and on advance, listed or not', () => {
    for (const form of ['full', 'advance'] as const) {
      for (const scene of SCENES) expect(gridFor(form, scene, listed), `${form} ${scene}`).toBe(WIDE);
    }
  });

  it('gives the tall grid on handheld to a scene its group lists as tall', () => {
    expect(gridFor('handheld', 'menu', listed)).toBe(TALL);
    expect(gridFor('handheld', 'map', listed)).toBe(TALL);
  });

  it('gives the wide grid on handheld to any other scene, letterboxed in the tall lens', () => {
    expect(gridFor('handheld', 'title', listed)).toBe(WIDE);
    expect(frameFor('handheld')).toBe(TALL);
    const lens = fit({ w: 341, h: 307 }, TALL);
    const screen = fit(lens, WIDE);
    expect(screen.w).toBe(lens.w);
    expect(screen.h).toBeLessThan(lens.h);
    expect(screen.y).toBeGreaterThan(0);
  });
});

describe('every scene on the tall grid', () => {
  it('reads every SceneName, each once, and the dispatcher draws exactly those', () => {
    expect(SCENES.length).toBeGreaterThan(0);
    expect(new Set(SCENES).size).toBe(SCENES.length);
    expect([...new Set(drawnScenes())].sort()).toEqual([...SCENES].sort());
  });

  it('lists every SceneName as tall, so the Game Boy held upright draws each one on the tall grid', () => {
    const untall = SCENES.filter((scene) => !TALL_SCENES.has(scene));
    expect(untall, 'scenes no group lists in its TALL_SCENES').toEqual([]);
    for (const scene of SCENES) expect(gridFor('handheld', scene), scene).toBe(TALL);
  });
});

describe('frameFor', () => {
  it('shapes the screen for the grid each form draws on', () => {
    expect(frameFor('full')).toBe(WIDE);
    expect(frameFor('advance')).toBe(WIDE);
    expect(frameFor('handheld')).toBe(TALL);
  });
});

describe('fit', () => {
  it('fills a 1440×900 window with a 1440×810 screen, centred', () => {
    expect(fit({ w: 1440, h: 900 }, WIDE)).toEqual({ scale: 2.25, w: 1440, h: 810, x: 0, y: 45 });
  });

  it('keeps the shape, fractions allowed, with bars on the two sides it does not reach', () => {
    const r = fit({ w: 1000, h: 400 }, WIDE);
    expect(r.scale).toBeCloseTo(400 / 360);
    expect(r.h).toBeCloseTo(400);
    expect(r.x).toBeCloseTo((1000 - r.w) / 2);
    expect(r.y).toBe(0);
  });

  it('puts the tall grid at 1.0× or more in a 393px-wide Game Boy lens', () => {
    expect(fit({ w: 341, h: 400 }, TALL).scale).toBeGreaterThanOrEqual(1);
  });
});

describe('pagesFor', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const view = buildGalaxy(demoEvents(now), { projects: DEMO_PROJECTS, now, source: 'demo' });

  it('gives one page to a scene no group declares pages for', () => {
    expect(pagesFor('heroes', { view, grid: TALL }, {})).toBe(1);
    expect(pagesFor('briefing', { view: null, grid: TALL }, {})).toBe(1);
  });

  it('gives the pages a group declares, and never fewer than one', () => {
    const declared = { heroes: ({ grid }: { grid: typeof TALL }) => (grid.name === 'tall' ? 3 : 1), briefing: () => 0 };
    expect(pagesFor('heroes', { view, grid: TALL }, declared)).toBe(3);
    expect(pagesFor('heroes', { view, grid: WIDE }, declared)).toBe(1);
    expect(pagesFor('briefing', { view, grid: TALL }, declared)).toBe(1);
  });

  it('gives one page without a galaxy', () => {
    expect(pagesFor('heroes', { view: null, grid: TALL }, { heroes: () => 4 })).toBe(1);
  });
});

describe('turnPage', () => {
  it('turns forward with ▶ and back with ◀, round from the last page to the first', () => {
    expect(turnPage(0, 3, 'right')).toBe(1);
    expect(turnPage(2, 3, 'right')).toBe(0);
    expect(turnPage(0, 3, 'left')).toBe(2);
    expect(turnPage(1, 3, 'left')).toBe(0);
  });

  it('turns from the last page when the page shown is past it (the grid changed under it)', () => {
    expect(turnPage(4, 2, 'left')).toBe(0);
    expect(turnPage(4, 2, 'right')).toBe(0);
  });

  it('stays on a single page', () => {
    expect(turnPage(0, 1, 'right')).toBe(0);
    expect(turnPage(0, 1, 'left')).toBe(0);
  });
});
