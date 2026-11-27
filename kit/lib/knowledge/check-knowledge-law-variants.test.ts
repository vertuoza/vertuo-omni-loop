// PRD 3375, s1: `omni check knowledge` reads `product/law-variants.json` and refuses what is wrong in it, by
// file and JSON path, offline; a `legal` id the product does not hold is refused online, and only a note
// while the page cannot say. Kept apart from check-knowledge.test.ts, which holds BR-PRODUCT-95's proof.
// Every law, flag, audience and login is fictional.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../../bin/omni.ts';
import { gradeKnowledge } from './check-knowledge.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const TODAY = new Date('2026-11-27T10:00:00Z');
const LAWS = [
  '## BL-PLANNINGANDTIMETRACKING-1',
  'A person records an absence once.',
  'Why: Two records pay a day twice.',
  '',
  '## BL-PLANNINGANDTIMETRACKING-6',
  'An absence shows on the planning.',
  'Why: A crew is never sent to a person who is away.',
  '',
].join('\n');

/** The spec's example file, as an object a test may change before it is written. */
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
      checked: { how: 'live', on: '2026-11-27' as string | null, release: 'v3.15.9', note: null } as Record<string, unknown>,
    },
  ],
});

type Example = ReturnType<typeof example>;

/** The example with `change` made to its first variant. */
function withVariant(change: (variant: Example['variants'][number], file: Example) => void): Example {
  const file = example();
  const first = file.variants[0];
  if (first === undefined) throw new Error('the example has a variant');
  change(first, file);
  return file;
}

describe('omni check knowledge — law variants, offline (PRD 3375)', () => {
  const VARIANTS = 'docs/knowledge/product/law-variants.json';
  const PLANNING = 'docs/knowledge/domains/planning-and-time-tracking/business-laws.md';
  const PRODUCT_LAYERS = Object.fromEntries(['principles.md', 'rules.md', 'invariants.md'].map((name) => [`docs/knowledge/product/${name}`, '# Product\n']));

  /** The violations of a knowledge folder holding the laws and, unless `null`, `variants` as the file's text. */
  function grade(variants: unknown, { raw = false, now = TODAY }: { raw?: boolean; now?: Date } = {}): string[] {
    const root = mkdtempSync(join(tmpdir(), 'check-law-variants-'));
    roots.push(root);
    const files: Record<string, string> = { ...PRODUCT_LAYERS, [PLANNING]: LAWS };
    if (variants !== null) files[VARIANTS] = raw ? String(variants) : JSON.stringify(variants, null, 2);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    const ctx = flatCtx(root, { laws: { source: 'knowledge', owners: ['pm-login'] } }) as Parameters<typeof gradeKnowledge>[0]['ctx'];
    return gradeKnowledge({ ctx, files: [], glossaryText: '', now: () => now }).violations;
  }

  it('passes the spec example, and reads nothing when there is no file', () => {
    expect(grade(example())).toEqual([]);
    expect(grade(null)).toEqual([]);
  });

  it('refuses an undeclared audience, naming the file and the JSON path (acceptance 1)', () => {
    const file = withVariant((variant) => {
      variant.audiences = { INTERNAL: 'on', BETTA: 'off', GENERAL: 'off', FINAL: 'off', 'new-tenants': 'on' };
    });
    expect(grade(file)).toEqual([`${VARIANTS}: variants[0].audiences.BETTA — not a declared audience`]);
  });

  it.each([
    ['a law none of the folder holds', withVariant((variant) => { variant.laws = ['BL-QUOTES-1']; }), 'variants[0].laws[0] — BL-QUOTES-1 is none of this knowledge folder\'s business laws'],
    ['a legal id not shaped L-<CODE>-<n>', withVariant((variant) => { variant.legal = ['COOK-1']; }), 'variants[0].legal[0] — COOK-1 is not shaped L-<CODE>-<n>'],
    ['live with no day', withVariant((variant) => { variant.checked = { how: 'live', on: null, release: null, note: null }; }), 'variants[0].checked.on — a live or code check needs its day'],
    ['a day after today', withVariant((variant) => { variant.checked = { how: 'code', on: '2026-11-28', release: null, note: null }; }), 'variants[0].checked.on — 2026-11-28 is after today, 2026-11-27'],
    ['a day that is none', withVariant((variant) => { variant.checked = { how: 'live', on: '2026-13-01', release: null, note: null }; }), 'variants[0].checked.on — must be a real day, YYYY-MM-DD'],
    ['a variant id used twice', withVariant((variant, file) => { file.variants.push({ ...variant }); }), 'variants[1].id — remove-absences-sidebar-rh is already the id of variants[0]'],
    ['an unknown key', withVariant((variant) => { Object.assign(variant, { flag: 'remove-absences-sidebar-rh' }); }), 'variants[0].flag — not a known field'],
  ])('refuses %s, by path (acceptance 2)', (_, file, problem) => {
    expect(grade(file)).toEqual([`${VARIANTS}: ${problem}`]);
  });

  it('refuses JSON that does not parse, naming the file', () => {
    expect(grade('{ "version": 1,', { raw: true })).toEqual([expect.stringMatching(new RegExp(`^${VARIANTS}: does not parse as JSON: `))]);
  });
});

describe('omni check knowledge — law variants, through the command (PRD 3375)', () => {
  const K = '.omni-loop/knowledge';
  const HOST = 'omni.test';
  const VARIANTS = `${K}/product/law-variants.json`;
  const CONFIG = ['kit: 1', 'repo:', '  slug: acme/widgets', 'laws:', '  source: none', '  owners: [pm-login]', 'ask:', `  url: https://${HOST}`, ''].join('\n');
  const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };
  const signedOut = { read: () => null, write: () => {} };
  const business = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    state: 'ok',
    business: { name: 'Acme' },
    product: { name: 'Builder' },
    claims: [],
    personas: [],
    legal: [{ id: 'L-COOK-1', statement: 'A tracking cookie waits for consent.', source: 'ePrivacy', owner: 'jane' }],
    glossary: [],
    domains: [{ key: 'planning-and-time-tracking', name: 'Planning', meaning: 'Crews and their time.' }],
    lawHome: 'acme/widgets',
    ...extra,
  });

  /** A page answering every read with `answer`, or none at all when `down`. */
  function page({ answer = business(), down = false }: { answer?: unknown; down?: boolean } = {}) {
    const urls: string[] = [];
    const fetch = (url: string): Promise<Response> => {
      urls.push(url);
      return down ? Promise.reject(new TypeError('fetch failed')) : Promise.resolve(new Response(JSON.stringify(answer)));
    };
    return { urls, fetch };
  }

  /** `omni check knowledge` in a repository holding the laws and `variants` (the file left out when `null`). */
  async function check(variants: unknown, server: ReturnType<typeof page>, tokens: unknown = signedIn) {
    const layers = Object.fromEntries(['principles', 'rules', 'invariants'].map((name) => [`${K}/product/${name}.md`, '# Product\n']));
    const files: Record<string, string> = { '.omni-loop/config.yml': CONFIG, ...layers, [`${K}/domains/planning-and-time-tracking/business-laws.md`]: LAWS };
    if (variants !== null) files[VARIANTS] = typeof variants === 'string' ? variants : JSON.stringify(variants, null, 2);
    const { root } = makeRepo({ git: true, files });
    roots.push(root);
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(['check', 'knowledge'], {
      cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) }, tokens, fetch: server.fetch, now: () => TODAY,
    });
    return { code, out: out.join(''), err: err.join('') };
  }

  /** The example, checked before today, naming `legal`. */
  const naming = (...legal: string[]) => withVariant((variant) => {
    variant.legal = legal;
    variant.checked = { how: 'live', on: '2026-11-01', release: 'v3.15.9', note: null };
  });

  it('passes a file whose Legal ids the product holds, and prints nothing about the variants', async () => {
    const result = await check(naming('L-COOK-1'), page());
    expect(result).toMatchObject({ code: 0, out: expect.not.stringMatching(/law-variants|Legal not verified/) as unknown });
  });

  it('refuses a Legal id the product does not hold, by path (acceptance 3, signed in)', async () => {
    const result = await check(naming('L-COOK-1', 'L-COOK-9'), page());
    expect(result.code).toBe(1);
    expect(result.out).toContain(`${VARIANTS}: variants[0].legal[1] — names L-COOK-9, which product Builder does not hold.`);
    expect(result.out).not.toContain('legal[0]');
  });

  it('only notes a Legal id it cannot verify: no sign-in, or the page unreachable (acceptance 3)', async () => {
    const signedOutRun = await check(naming('L-COOK-9'), page(), signedOut);
    expect(signedOutRun.code).toBe(0);
    expect(signedOutRun.out).toContain('Legal not verified: not signed in');
    const down = await check(naming('L-COOK-9'), page({ down: true }));
    expect(down.code).toBe(0);
    expect(down.out).toContain('Legal not verified: page unreachable');
  });

  it('refuses a Legal id in a repository of no product', async () => {
    const result = await check(naming('L-COOK-1'), page({ answer: business({ product: null }) }));
    expect(result.code).toBe(1);
    expect(result.out).toContain(`${VARIANTS}: variants[0].legal[0] — names L-COOK-1, but this repository belongs to no product.`);
  });

  it('refuses the offline problems through the command too, and asks the page nothing about a file that does not read', async () => {
    const result = await check(withVariant((variant) => { variant.audiences = { BETTA: 'on' }; variant.legal = ['L-COOK-9']; }), page(), signedOut);
    expect(result.code).toBe(1);
    expect(result.out).toContain(`${VARIANTS}: variants[0].audiences.BETTA — not a declared audience`);
    const broken = await check('{', page());
    expect(broken.code).toBe(1);
    expect(broken.out).toContain(`${VARIANTS}: does not parse as JSON`);
    expect(broken.out).not.toContain('Legal not verified');
  });

  it('warns, never refuses, a file over 512 KiB, which a pack would soon leave out', async () => {
    const big = { ...naming('L-COOK-1'), about: 'x'.repeat(530 * 1024) };
    const result = await check(big, page());
    expect(result.code).toBe(0);
    expect(result.out).toMatch(new RegExp(`warning: ${VARIANTS}: 53\\d KiB — over 512 KiB: a pack leaves out a file over 1 MiB, and the Omni page would not see it\\.`));
    const small = await check(naming('L-COOK-1'), page());
    expect(small.out).not.toContain('KiB');
  });
});
