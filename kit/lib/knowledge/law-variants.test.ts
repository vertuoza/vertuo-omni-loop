// PRD 3375, s1: a product's law variants, `product/law-variants.json` of its knowledge folder. Every reader
// (the check, the terminal, the MCP, the page) goes through this module, so its refusals and its lines are
// the contract each one trusts. The clock is always passed in.
import { describe, expect, it } from 'vitest';
import {
  freshnessOf,
  LAW_VARIANTS_FILE,
  lawVariantProblems,
  lawVariantsDiff,
  lawVariantsOfPackFiles,
  LawVariantsSchema,
  parseLawVariants,
  variantLines,
  type LawVariants,
} from './law-variants.ts';

const TODAY = new Date('2026-11-27T10:00:00Z');

/** The spec's example file, as an object a test may change before it is written as text. */
const example = () => ({
  version: 1,
  about: 'What differs between user types in the Expert+ pack.',
  staleAfterDays: 30,
  audiences: [
    { id: 'INTERNAL', label: 'Internal' },
    { id: 'BETA', label: 'Beta' },
    { id: 'GENERAL', label: 'General' },
    { id: 'FINAL', label: 'Final' },
    { id: 'new-tenants', label: 'New tenants', note: 'tenants created after the flag was turned on' },
  ],
  variants: [
    {
      id: 'remove-absences-sidebar-rh',
      condition: { kind: 'flag', key: 'remove-absences-sidebar-rh' },
      feature: 'Where Absences are recorded',
      on: 'HR shows Time Entries only; Absences are recorded from the planning by person',
      off: 'HR also has an Absences planning (V1) where Absences are recorded',
      audiences: { INTERNAL: 'on', BETA: 'off', GENERAL: 'off', FINAL: 'off', 'new-tenants': 'on' } as Record<string, string>,
      laws: ['BL-PLANNINGANDTIMETRACKING-1', 'BL-PLANNINGANDTIMETRACKING-6'],
      legal: [] as string[],
      checked: { how: 'live', on: '2026-11-27' as string | null, release: 'v3.15.9' as string | null, note: null as string | null },
    },
  ],
});

type Example = ReturnType<typeof example>;

/** Problems of a file given as an object: its parse's, else its cross-field ones. */
function problemsOf(file: unknown, { laws = ['BL-PLANNINGANDTIMETRACKING-1', 'BL-PLANNINGANDTIMETRACKING-6'], today = TODAY }: { laws?: string[] | null; today?: Date } = {}): string[] {
  const read = parseLawVariants(JSON.stringify(file));
  return read.ok ? lawVariantProblems(read.value, { laws, today }) : read.problems;
}

/** The example with `change` applied to a fresh copy. */
function changed(change: (file: Example) => void): Example {
  const file = example();
  change(file);
  return file;
}

function read(file: unknown): LawVariants {
  const result = parseLawVariants(JSON.stringify(file));
  if (!result.ok) throw new Error(result.problems.join('\n'));
  return result.value;
}

describe('parseLawVariants and lawVariantProblems (PRD 3375)', () => {
  it('reads the spec example with no problem, defaulting what it leaves out', () => {
    expect(problemsOf(example())).toEqual([]);
    const value = read({ version: 1, audiences: [{ id: 'A', label: 'A' }], variants: [{ ...example().variants[0], audiences: { A: 'on' }, checked: { how: 'unchecked' } }] });
    expect(value.staleAfterDays).toBe(30);
    expect(value.variants[0]?.checked).toEqual({ how: 'unchecked', on: null, release: null, note: null });
  });

  it('reads through the exported schema of version 1, which a reader of the value may parse with', () => {
    expect(LawVariantsSchema.parse(example())).toEqual(read(example()));
    expect(LawVariantsSchema.safeParse({ ...example(), version: 2 }).success).toBe(false);
  });

  it('refuses JSON that does not parse, and a file that is no object', () => {
    const broken = parseLawVariants('{ "version": 1,');
    expect(broken.ok).toBe(false);
    expect(broken.ok ? [] : broken.problems).toEqual([expect.stringMatching(/^does not parse as JSON: /)]);
    expect(problemsOf([])).toEqual(['must be an object']);
  });

  it('refuses every field off the schema, naming each by its JSON path', () => {
    const file = changed((f) => {
      Object.assign(f, { version: 2, about: 'two\nlines', staleAfterDays: 0 });
      f.audiences[1] = { id: '', label: '' };
      const variant = f.variants[0];
      if (variant === undefined) throw new Error('no variant');
      Object.assign(variant, { feature: '', condition: { kind: 'flag' }, audiences: { BETA: 'maybe' }, legal: ['COOK-1'] });
      variant.checked = { how: 'seen', on: '2026-02-30', release: null, note: null };
    });
    expect(problemsOf(file)).toEqual([
      'version — must be 1',
      'about — must be one line',
      'staleAfterDays — must be 1 or more',
      'audiences[1].id — must not be empty',
      'audiences[1].label — must not be empty',
      'variants[0].condition.key — is missing',
      'variants[0].feature — must not be empty',
      'variants[0].audiences.BETA — must be "on" or "off"',
      'variants[0].legal[0] — COOK-1 is not shaped L-<CODE>-<n>',
      'variants[0].checked.how — must be "live", "code" or "unchecked"',
      'variants[0].checked.on — must be a real day, YYYY-MM-DD',
    ]);
  });

  it('refuses a whole number that is not one, no audience at all, and a variant mapping none', () => {
    expect(problemsOf({ ...example(), staleAfterDays: 1.5 })).toEqual(['staleAfterDays — must be a whole number']);
    expect(problemsOf({ ...example(), audiences: [] })).toEqual(['audiences — must hold at least 1']);
    expect(problemsOf(changed((f) => { if (f.variants[0]) f.variants[0].audiences = {}; }))).toEqual(['variants[0].audiences — must map at least one audience']);
  });

  it('refuses an unknown key anywhere, so a typo never passes as data', () => {
    const file = changed((f) => {
      Object.assign(f, { extra: true });
      Object.assign(f.audiences[0] ?? {}, { lable: 'x' });
      Object.assign(f.variants[0] ?? {}, { flag: 'x' });
      Object.assign(f.variants[0]?.checked ?? {}, { seen: 'live' });
    });
    expect(problemsOf(file)).toEqual([
      'audiences[0].lable — not a known field',
      'variants[0].checked.seen — not a known field',
      'variants[0].flag — not a known field',
      'extra — not a known field',
    ]);
  });

  it('refuses live or code with no day, and allows none for unchecked', () => {
    for (const how of ['live', 'code']) {
      expect(problemsOf(changed((f) => { if (f.variants[0]) f.variants[0].checked = { how, on: null, release: null, note: null }; }))).toEqual([
        'variants[0].checked.on — a live or code check needs its day',
      ]);
    }
    expect(problemsOf(changed((f) => { if (f.variants[0]) f.variants[0].checked = { how: 'unchecked', on: null, release: null, note: null }; }))).toEqual([]);
  });

  it('refuses an undeclared audience, a duplicate id, an unknown law and a day after today', () => {
    const file = changed((f) => {
      const first = f.variants[0];
      if (first === undefined) throw new Error('no variant');
      first.audiences = { INTERNAL: 'on', BETTA: 'off' };
      first.laws = ['BL-PLANNINGANDTIMETRACKING-1', 'BL-QUOTES-9'];
      first.checked.on = '2026-11-28';
      f.variants.push({ ...first, audiences: { INTERNAL: 'on' }, laws: [], checked: { how: 'code', on: '2026-11-27', release: null, note: null } });
      f.audiences.push({ id: 'BETA', label: 'Beta again' });
    });
    expect(problemsOf(file)).toEqual([
      'audiences[5].id — BETA is already declared at audiences[1]',
      'variants[0].audiences.BETTA — not a declared audience',
      'variants[0].laws[1] — BL-QUOTES-9 is none of this knowledge folder\'s business laws',
      'variants[0].checked.on — 2026-11-28 is after today, 2026-11-27',
      'variants[1].id — remove-absences-sidebar-rh is already the id of variants[0]',
    ]);
  });

  it('looks no law up when it is given none, and reads the day today as today', () => {
    expect(problemsOf(changed((f) => { if (f.variants[0]) f.variants[0].laws = ['BL-ANY-1']; }), { laws: null })).toEqual([]);
    expect(problemsOf(example(), { today: new Date('2026-11-27T00:00:00Z') })).toEqual([]);
  });
});

describe('freshnessOf (PRD 3375)', () => {
  const live = (on: string) => ({ how: 'live' as const, on, release: null, note: null });

  it('is fresh at day 30 of 30, stale at day 31, and counts whole days of the clock it is given', () => {
    expect(freshnessOf(live('2026-10-28'), 30, TODAY)).toEqual({ state: 'fresh', days: 30 });
    expect(freshnessOf(live('2026-10-27'), 30, TODAY)).toEqual({ state: 'stale', days: 31 });
    expect(freshnessOf(live('2026-11-27'), 30, new Date('2026-11-27T23:59:59Z'))).toEqual({ state: 'fresh', days: 0 });
    expect(freshnessOf({ how: 'code', on: '2026-11-20', release: null, note: null }, 5, TODAY)).toEqual({ state: 'stale', days: 7 });
  });

  it('is unchecked for an unchecked variant, whatever its day', () => {
    expect(freshnessOf({ how: 'unchecked', on: '2020-01-01', release: null, note: null }, 30, TODAY)).toEqual({ state: 'unchecked' });
    expect(freshnessOf({ how: 'unchecked', on: null, release: null, note: null }, 30, TODAY)).toEqual({ state: 'unchecked' });
  });
});

describe('variantLines (PRD 3375)', () => {
  it('gives one line per variant naming a law, its on audiences in file order', () => {
    expect(variantLines(read(example()), 'BL-PLANNINGANDTIMETRACKING-1', TODAY)).toEqual([
      'Differs for: Internal, New tenants — Where Absences are recorded (flag remove-absences-sidebar-rh) · checked live 2026-11-27 · v3.15.9',
    ]);
    expect(variantLines(read(example()), 'BL-QUOTES-1', TODAY)).toEqual([]);
  });

  it('ends a stale check with stale, reads an unchecked one as not checked, and names a Legal entry too', () => {
    expect(variantLines(read(example()), 'BL-PLANNINGANDTIMETRACKING-6', new Date('2026-12-28T00:00:00Z'))).toEqual([
      'Differs for: Internal, New tenants — Where Absences are recorded (flag remove-absences-sidebar-rh) · checked live 2026-11-27 · v3.15.9 · stale',
    ]);
    const unchecked = changed((f) => {
      if (f.variants[0]) Object.assign(f.variants[0], { legal: ['L-COOK-1'], audiences: { BETA: 'off' }, checked: { how: 'unchecked', on: null, release: 'v1', note: null } });
    });
    expect(variantLines(read(unchecked), 'L-COOK-1', TODAY)).toEqual([
      'Differs for: none — Where Absences are recorded (flag remove-absences-sidebar-rh) · not checked',
    ]);
  });
});

describe('lawVariantsDiff (PRD 3375)', () => {
  it('finds no change between a file and itself', () => {
    expect(lawVariantsDiff(read(example()), read(example()))).toEqual({ added: [], removed: [], changed: [] });
  });

  it('lists every variant as added when the file is absent at the base, and as removed when it is gone', () => {
    const head = read(example());
    expect(lawVariantsDiff(null, head)).toEqual({ added: head.variants, removed: [], changed: [] });
    expect(lawVariantsDiff(head, null)).toEqual({ added: [], removed: head.variants, changed: [] });
  });

  it('names each changed field as old → new, and the variants added and removed', () => {
    const base = changed((f) => {
      const first = f.variants[0];
      if (first === undefined) throw new Error('no variant');
      first.checked.on = '2026-11-01';
      f.variants.push({ ...first, id: 'gone', feature: 'Gone' });
    });
    const head = changed((f) => {
      const first = f.variants[0];
      if (first === undefined) throw new Error('no variant');
      first.audiences = { ...first.audiences, BETA: 'on' };
      delete first.audiences.FINAL;
      first.laws = ['BL-PLANNINGANDTIMETRACKING-1'];
      first.checked.release = 'v3.16.0';
      f.variants.push({ ...first, id: 'new-one', feature: 'New' });
    });
    const diff = lawVariantsDiff(read(base), read(head));
    expect(diff.added.map((variant) => variant.id)).toEqual(['new-one']);
    expect(diff.removed.map((variant) => variant.id)).toEqual(['gone']);
    expect(diff.changed).toEqual([{
      id: 'remove-absences-sidebar-rh',
      feature: 'Where Absences are recorded',
      fields: [
        { field: 'BETA', from: 'off', to: 'on' },
        { field: 'FINAL', from: 'off', to: '—' },
        { field: 'laws', from: 'BL-PLANNINGANDTIMETRACKING-1, BL-PLANNINGANDTIMETRACKING-6', to: 'BL-PLANNINGANDTIMETRACKING-1' },
        { field: 'checked', from: 'live 2026-11-01', to: 'live 2026-11-27' },
        { field: 'checked.release', from: 'v3.15.9', to: 'v3.16.0' },
      ],
    }]);
  });
});

describe('lawVariantsOfPackFiles (PRD 3375)', () => {
  const path = `.omni-loop/knowledge/product/${LAW_VARIANTS_FILE}`;

  it('reads the file of the pack\'s knowledge folder, and finds none when the pack holds none', () => {
    expect(lawVariantsOfPackFiles([{ path, content: JSON.stringify(example()) }])).toEqual({ state: 'read', file: path, variants: read(example()) });
    expect(lawVariantsOfPackFiles([{ path: 'docs/knowledge/product/law-variants.json', content: '{' }])).toEqual({ state: 'none' });
    expect(lawVariantsOfPackFiles([{ path: 'docs/knowledge/product/law-variants.json', content: JSON.stringify(example()) }], 'docs/knowledge').state).toBe('read');
  });

  it('gives a file that does not read as one note, never a throw', () => {
    expect(lawVariantsOfPackFiles([{ path, content: JSON.stringify({ ...example(), version: 2 }) }])).toEqual({
      state: 'unreadable',
      file: path,
      problems: ['version — must be 1'],
      note: `law variants: ${path} does not read — version — must be 1`,
    });
  });
});
