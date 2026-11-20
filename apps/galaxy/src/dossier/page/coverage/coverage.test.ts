import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ITEMS, type Item } from './items';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const { MOMENTS, renderFix, renderMoment, renderReview } = await import('./moments');

// AC-5: nothing is lost (omni-loop-20 s9). The inventory of the PRD page, `items.ts`, is data this test reads:
// the PRD page is rendered in each of its moments (a draft, waiting for approval, waiting for a Tech Approval,
// outbox open, ready, shipped, main broke), then the review screen of each signed decision and a fix's page,
// and every item must be found where its row says, in every moment its row lists. An item a static render
// cannot draw is proved by the existing test that names it.

const text = (html: string) => html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
  .replace(/\s+/g, ' ');

const cache = new Map<string, string>();
const rendered = (item: Item, moment: string | null): string => {
  const { on } = item;
  const key = JSON.stringify([on, moment]);
  const known = cache.get(key);
  if (known !== undefined) return known;
  let html: string;
  if (on.page === 'review') html = renderReview(on.kind);
  else if (on.page === 'fix') html = renderFix(on.tab);
  else {
    const name = MOMENTS.find((m) => m === moment);
    if (name === undefined) throw new Error(`no such moment: ${String(moment)}`);
    html = renderMoment(name, { ...(on.tab ? { tab: on.tab } : {}), ...(on.segment ? { segment: on.segment } : {}) });
  }
  cache.set(key, html);
  return html;
};

const found = (item: Item, moment: string | null) => {
  const html = rendered(item, moment);
  return item.html ? html.includes(item.find) : text(html).includes(item.find);
};

describe('the inventory of the PRD page', () => {
  it('names every item once, in one of its seven sections, with a place and words that find it', () => {
    const names = ITEMS.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(ITEMS.map((item) => item.section))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7]));
    for (const item of ITEMS) {
      expect(item.find, item.name).not.toBe('');
      if (item.on.page === 'prd') expect(item.moments.length, item.name).toBeGreaterThan(0);
    }
  });

  it('every moment of the PRD page shows something of the inventory', () => {
    for (const moment of MOMENTS) expect(ITEMS.some((item) => item.moments.includes(moment)), moment).toBe(true);
  });
});

describe('AC-5: every item of the inventory is found on the page or the review screen', () => {
  const drawn = ITEMS.filter((item) => item.proved === undefined);
  const proved = ITEMS.filter((item) => item.proved !== undefined);

  for (const item of drawn) {
    if (item.on.page === 'prd') {
      for (const moment of item.moments) {
        it(`${item.section} · ${item.name} (${moment})`, () => {
          expect(found(item, moment), item.find).toBe(true);
        });
      }
    } else {
      it(`${item.section} · ${item.name}`, () => {
        expect(found(item, null), item.find).toBe(true);
      });
    }
  }

  for (const item of proved) {
    it(`${item.section} · ${item.name}: proved by ${item.proved ?? ''}`, () => {
      const file = new URL(item.proved ?? '', import.meta.url);
      const alone = new URL(`../${item.proved ?? ''}`, import.meta.url);
      const path = existsSync(file) ? file : alone;
      expect(existsSync(path), item.proved).toBe(true);
      expect(readFileSync(path, 'utf8'), item.find).toContain(item.find);
    });
  }
});
