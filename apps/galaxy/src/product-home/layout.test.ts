import { describe, expect, it } from 'vitest';
import { labelBoxOf, layoutOf, skyHeightOf, SKY_WIDTH, type Box, type LayoutLine, type LayoutStar } from './layout';

// The Constellation's layout (PRD 2174 s2), a pure function on fixture repositories: a seeded spiral, 300
// force steps, then a separation pass. The same rows give the same map; no two label boxes overlap and no
// label box covers a star, at 1, 5, 18 and 30 stars, with and without lines; a line pulls its ends closer;
// every box stays 8 px inside the sky, whose height grows with the count.

const SEED = '7f3c2a10-0b5e-4c1d-9a8e-2174aaaabbbb';

/** Repository names shaped like a real product's: short, long, and past 28 characters. */
const NAMES = [
  'vertuo-apps', 'vertuo-backend-php', 'vertuo-mobile', 'vertuo-automation-plan', 'vertuo-design-system',
  'vertuo-pdf-renderer-and-exports-service', 'api', 'vertuo-ai-domain', 'vertuo-infra', 'vertuo-docs',
  'vertuo-quotes', 'vertuo-invoicing', 'vertuo-planning', 'vertuo-identity', 'vertuo-notifications',
  'vertuo-search', 'vertuo-reporting-and-analytics-warehouse', 'web', 'vertuo-integrations-hub', 'vertuo-sync',
  'vertuo-files', 'vertuo-timesheets', 'vertuo-crm', 'vertuo-gateway', 'vertuo-billing', 'vertuo-catalog',
  'vertuo-admin-console', 'vertuo-webhooks', 'vertuo-scheduler', 'vertuo-emails',
];

const starsOf = (n: number): LayoutStar[] =>
  NAMES.slice(0, n).map((name, i) => ({ repository: `vertuoza/${name}`, role: i % 3 === 0 ? 'the main web app' : null }));

/** A web of plan lines: each star joined to the next, and the first few to many, weights 1 to 9. */
function linesOf(stars: readonly LayoutStar[]): LayoutLine[] {
  const names = stars.map((s) => s.repository);
  const [hub = ''] = names;
  return [
    ...names.slice(1).map((b, i) => ({ a: names[i] ?? '', b, weight: 1 + ((i + 1) % 9) })),
    ...names.filter((_, i) => i >= 2 && (i - 2) % 3 === 0).map((b) => ({ a: hub, b, weight: 7 })),
  ];
}

const overlap = (p: Box, q: Box) => p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;

const covers = (box: Box, at: { x: number; y: number }) =>
  at.x >= box.x && at.x <= box.x + box.width && at.y >= box.y && at.y <= box.y + box.height;

/** The value of `key` in `map`, which must hold it. */
function get<T>(map: ReadonlyMap<string, T>, key: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`no ${key}`);
  return value;
}

const distance = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);

describe('the sky', () => {
  it('is 960 wide, and max(500, 120 × ceil(n / 4)) tall', () => {
    expect(SKY_WIDTH).toBe(960);
    expect(skyHeightOf(1)).toBe(500);
    expect(skyHeightOf(5)).toBe(500);
    expect(skyHeightOf(18)).toBe(600);
    expect(skyHeightOf(30)).toBe(960);
    expect(layoutOf(starsOf(18), [], SEED).height).toBe(600);
    expect(layoutOf(starsOf(30), [], SEED).width).toBe(960);
  });
});

describe('a label box', () => {
  it('is the name at 7.8 px a character plus the star, 66 px tall from 24 px above the star', () => {
    expect(labelBoxOf({ repository: 'acme/api', role: null }, { x: 100, y: 200 })).toEqual({
      x: 100 - (3 * 7.8 + 44) / 2, y: 176, width: 3 * 7.8 + 44, height: 66,
    });
  });

  it('measures a name longer than 28 characters at 28', () => {
    const long = labelBoxOf({ repository: 'acme/vertuo-pdf-renderer-and-exports-service', role: null }, { x: 0, y: 0 });
    expect(long.width).toBeCloseTo(28 * 7.8 + 44);
  });

  it('measures the role when it is longer than the name', () => {
    expect(labelBoxOf({ repository: 'acme/api', role: 'the main web app' }, { x: 0, y: 0 }).width).toBeCloseTo(16 * 7.8 + 44);
  });
});

describe('layoutOf', () => {
  it('places nothing for no star', () => {
    const map = layoutOf([], [], SEED);
    expect(map.at.size).toBe(0);
    expect(map.height).toBe(500);
  });

  it('places a lone star inside the sky', () => {
    const map = layoutOf(starsOf(1), [], SEED);
    const at = get(map.at, 'vertuoza/vertuo-apps');
    expect(get(map.boxes, 'vertuoza/vertuo-apps')).toEqual(labelBoxOf({ repository: 'vertuoza/vertuo-apps', role: 'the main web app' }, at));
  });

  it('gives the same points on two calls, and whatever order the rows come in', () => {
    const stars = starsOf(18);
    const first = layoutOf(stars, linesOf(stars), SEED);
    const again = layoutOf(stars, linesOf(stars), SEED);
    const shuffled = layoutOf([...stars].reverse(), [...linesOf(stars)].reverse(), SEED);
    expect([...again.at]).toEqual([...first.at]);
    expect(Object.fromEntries(shuffled.at)).toEqual(Object.fromEntries(first.at));
  });

  it('gives another map for another seed', () => {
    const stars = starsOf(5);
    expect(Object.fromEntries(layoutOf(stars, [], 'another product').at)).not.toEqual(Object.fromEntries(layoutOf(stars, [], SEED).at));
  });

  it('ignores a line to a star it does not place, and a line from a star to itself', () => {
    const stars = starsOf(5);
    const lines: LayoutLine[] = [{ a: 'vertuoza/vertuo-apps', b: 'vertuoza/elsewhere', weight: 3 }, { a: 'vertuoza/api', b: 'vertuoza/api', weight: 2 }];
    expect(Object.fromEntries(layoutOf(stars, lines, SEED).at)).toEqual(Object.fromEntries(layoutOf(stars, [], SEED).at));
  });
});

describe('the labels', () => {
  for (const n of [1, 5, 18, 30]) {
    for (const withLines of [false, true]) {
      it(`at ${String(n)} stars ${withLines ? 'with' : 'without'} lines, no label overlaps another or covers a star, every box 8 px inside`, () => {
        const stars = starsOf(n);
        const map = layoutOf(stars, withLines ? linesOf(stars) : [], SEED);
        const names = stars.map((s) => s.repository);
        expect(map.at.size).toBe(n);
        for (const name of names) {
          const box = get(map.boxes, name);
          expect(box.x).toBeGreaterThanOrEqual(8);
          expect(box.y).toBeGreaterThanOrEqual(8);
          expect(box.x + box.width).toBeLessThanOrEqual(map.width - 8);
          expect(box.y + box.height).toBeLessThanOrEqual(map.height - 8);
          for (const other of names) {
            if (other === name) continue;
            expect(overlap(box, get(map.boxes, other)), `${name} over ${other}`).toBe(false);
            expect(covers(box, get(map.at, other)), `${name} covers ${other}`).toBe(false);
          }
        }
      });
    }
  }
});

describe('the lines', () => {
  it('on average, sets two stars a line joins closer than two it does not', () => {
    for (const n of [5, 18, 30]) {
      const stars = starsOf(n);
      const lines = linesOf(stars);
      const map = layoutOf(stars, lines, SEED);
      const joined = new Set(lines.map((l) => [l.a, l.b].sort().join(' ')));
      const near: number[] = [];
      const far: number[] = [];
      stars.forEach((p, i) => {
        for (const q of stars.slice(i + 1)) {
          const d = distance(get(map.at, p.repository), get(map.at, q.repository));
          (joined.has([p.repository, q.repository].sort().join(' ')) ? near : far).push(d);
        }
      });
      const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      expect(mean(near), `at ${String(n)} stars`).toBeLessThan(mean(far));
    }
  });
});
