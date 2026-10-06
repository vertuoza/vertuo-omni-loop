// The sync's six rules (PRD 262), on in-memory fixtures: what the repository says has shipped, and
// what the table already holds, in; the rows to insert and the texts to refresh, out.
import { describe, it, expect } from 'vitest';
import type { ReleaseRow } from './row';
import { applySync, planSync, type ShippedPrd } from './sync';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** A shipped PRD as the repository reads it: its note (or its spec title), and when it reached main. */
function shipped(prd: number, at: string, over: Partial<ShippedPrd> = {}): ShippedPrd {
  return { prd: parsePrd(prd), releasedAt: at, title: `Title of ${prd}`, description: `What ${prd} does.`, pinned: false, ...over };
}

function row(prd: number, release: number, at: string, over: Partial<ReleaseRow> = {}): ReleaseRow {
  return { prd: parsePrd(prd), release, released_at: at, title: `Title of ${prd}`, description: `What ${prd} does.`, ...over };
}

const MON = '2026-09-28T10:00:00+02:00';
const TUE = '2026-09-29T10:00:00+02:00';
const WED = '2026-09-30T10:00:00+02:00';

describe('planSync — the rows a sync writes', () => {
  it('gives every note pinned to the initial release the release 1', () => {
    const plan = planSync([shipped(3, '2026-09-24T10:00:00+02:00', { pinned: true }), shipped(7, '2026-09-27T10:00:00+02:00', { pinned: true })], []);
    expect(plan.inserts.map((r) => [r.prd, r.release])).toEqual([[3, 1], [7, 1]]);
    expect(plan.updates).toEqual([]);
  });

  it('numbers the other PRDs from 2, in the order they reached main, the lower PRD first on a tie', () => {
    const plan = planSync([
      shipped(3, '2026-09-24T10:00:00+02:00', { pinned: true }),
      shipped(300, WED),
      shipped(262, MON),
      shipped(270, TUE),
      shipped(255, TUE),
    ], []);
    expect(plan.inserts.map((r) => [r.prd, r.release])).toEqual([[3, 1], [262, 2], [255, 3], [270, 4], [300, 5]]);
  });

  it('orders by the instant, whatever the offset each date is written with', () => {
    const plan = planSync([shipped(10, '2026-09-28T09:30:00+00:00'), shipped(11, '2026-09-28T11:00:00+02:00')], []);
    expect(plan.inserts.map((r) => r.prd)).toEqual([11, 10]); // 09:00 UTC before 09:30 UTC
  });

  it('dates each new row by when its shipped folder first reached main, and carries its note', () => {
    const [inserted] = planSync([shipped(262, MON, { title: 'Release notes for everyone', description: 'A public page.' })], []).inserts;
    expect(inserted).toEqual({ prd: parsePrd(262), release: 2, released_at: MON, title: 'Release notes for everyone', description: 'A public page.' });
  });

  it('keeps an existing row\'s number and date forever, and refreshes only its title and description', () => {
    const rows = [row(3, 1, '2026-09-24T10:00:00+02:00'), row(262, 2, MON)];
    const plan = planSync([
      shipped(3, WED, { pinned: false, title: 'A fixed typo' }),
      shipped(262, TUE, { pinned: true, description: 'A clearer line.' }),
    ], rows);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([
      { prd: parsePrd(3), title: 'A fixed typo', description: 'What 3 does.' },
      { prd: parsePrd(262), title: 'Title of 262', description: 'A clearer line.' },
    ]);
    expect(applySync(rows, plan)).toEqual([row(3, 1, '2026-09-24T10:00:00+02:00', { title: 'A fixed typo' }), row(262, 2, MON, { description: 'A clearer line.' })]);
  });

  it('writes nothing for a row whose text has not changed', () => {
    expect(planSync([shipped(262, MON)], [row(262, 2, MON)])).toEqual({ inserts: [], updates: [] });
  });

  it('numbers a new PRD after the highest release the table holds', () => {
    const plan = planSync([shipped(300, WED)], [row(3, 1, '2026-09-24T10:00:00+02:00'), row(262, 2, MON), row(270, 7, TUE)]);
    expect(plan.inserts.map((r) => [r.prd, r.release])).toEqual([[300, 8]]);
  });

  it('publishes a PRD with no note under its spec title and an empty description', () => {
    // The repository reading hands such a PRD over as its spec title and '' (sync-shipped.ts); the
    // rules number it like any other.
    const plan = planSync([shipped(255, MON, { title: 'Ask tabs — one per terminal', description: '' })], []);
    expect(plan.inserts).toEqual([{ prd: parsePrd(255), release: 2, released_at: MON, title: 'Ask tabs — one per terminal', description: '' }]);
  });

  it('never deletes a row, even one the repository no longer ships', () => {
    const rows = [row(3, 1, '2026-09-24T10:00:00+02:00'), row(99, 5, TUE)];
    const plan = planSync([shipped(300, WED)], rows);
    expect(Object.keys(plan)).toEqual(['inserts', 'updates']);
    expect(applySync(rows, plan).map((r) => r.prd)).toEqual([3, 99, 300]);
  });

  it('rebuilds, from an empty table, the rows it wrote step by step', () => {
    const initial = [3, 7, 28].map((prd) => shipped(prd, '2026-09-27T10:00:00+02:00', { pinned: true }));
    const monday = [...initial, shipped(262, MON), shipped(255, MON)];
    const tuesday = [...monday, shipped(270, TUE)];
    const wednesday = [...tuesday, shipped(300, WED), shipped(290, WED)].map((s) => (s.prd === 262 ? { ...s, title: 'Edited later' } : s));

    let stepped: ReleaseRow[] = [];
    for (const repository of [initial, monday, tuesday, wednesday]) stepped = applySync(stepped, planSync(repository, stepped));
    const rebuilt = applySync([], planSync(wednesday, []));

    expect(rebuilt).toEqual(stepped);
    expect(stepped.map((r) => [r.prd, r.release])).toEqual([[3, 1], [7, 1], [28, 1], [255, 2], [262, 3], [270, 4], [290, 5], [300, 6]]);
  });
});
