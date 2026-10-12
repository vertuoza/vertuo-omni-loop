import { describe, expect, it, vi } from 'vitest';
import { parseConcept } from 'vertuo-omni-plan/kit/lib/concept/parse.ts';
import { parseIssue, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { areaViews, readAreaPages } from './areas';
import { CONCEPT_1269 } from './list.fixture';

// A concept's Areas tab (PRD 1272, s3): the areas in build order, the wedge first, each PRD linked to its
// page or its issue, and the brainstorm line of the first area without a PRD.

const parsed = parseConcept(CONCEPT_1269);
if (!parsed.ok) throw new Error(parsed.errors.join('; '));
const AREAS = parsed.record.areas;
const C1269 = parseIssue(1269);

describe('the Areas tab', () => {
  it('lists concept #1269\'s six areas in build order, the wedge (server-approval) first and marked, and its line', () => {
    const views = areaViews(AREAS, C1269, 'acme/widgets', new Map());
    expect(views.map((v) => v.id)).toEqual(['server-approval', 'approval-handshake', 'product-home', 'product-gate', 'product-records', 'constellation-tab']);
    expect(views.map((v) => v.wedge)).toEqual([true, false, false, false, false, false]);
    expect(views.map((v) => v.next)).toEqual(['/omni:brainstorm --concept 1269 server-approval', null, null, null, null, null]);
    expect(views.every((v) => v.prd === null)).toBe(true);
  });

  it('links a PRD to its dossier page, or to its issue when it has none, and gives the line of the first area left', () => {
    const areas = AREAS.map((area, i) => (i === 0 ? { ...area, prd: parsePrd(1300) } : i === 1 ? { ...area, prd: parsePrd(1301) } : area));
    const views = areaViews(areas, C1269, 'acme/widgets', new Map([[parsePrd(1300), 'd-1300']]));
    expect(views[0]?.prd).toEqual({ number: 1300, href: '/prd/d-1300', to: 'page' });
    expect(views[1]?.prd).toEqual({ number: 1301, href: 'https://github.com/acme/widgets/issues/1301', to: 'issue' });
    expect(views.map((v) => v.next)).toEqual([null, null, '/omni:brainstorm --concept 1269 product-home', null, null, null]);
  });

  it('gives no line once every area has a PRD, nor for a concept with no number', () => {
    const done = AREAS.map((area, i) => ({ ...area, prd: parsePrd(1300 + i) }));
    expect(areaViews(done, C1269, 'acme/widgets', new Map()).some((v) => v.next !== null)).toBe(false);
    expect(areaViews(AREAS, null, 'acme/widgets', new Map()).some((v) => v.next !== null)).toBe(false);
  });
});

describe('which PRDs have a page', () => {
  it('asks once per PRD, as a PRD in the concept\'s repository, and leaves out one with no page or a failed lookup', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const asked: string[] = [];
    const reader = {
      numbered: (repo: string, prd: number, kind?: string) => {
        asked.push(`${repo} ${prd} ${kind}`);
        if (prd === 3) return Promise.reject(new Error('down'));
        return Promise.resolve(prd === 1 ? 'd-1' : null);
      },
    };
    const pages = await readAreaPages(reader, 'acme/widgets', [parsePrd(1), parsePrd(2), parsePrd(1), parsePrd(3)]);
    expect([...pages]).toEqual([[1, 'd-1']]);
    expect(asked).toEqual(['acme/widgets 1 prd', 'acme/widgets 2 prd', 'acme/widgets 3 prd']);
    vi.restoreAllMocks();
  });
});
