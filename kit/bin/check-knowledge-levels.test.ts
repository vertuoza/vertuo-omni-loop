// PRD 2416, s4: `omni check knowledge` refuses a repository's product rule that contradicts one of a
// level above it (its plan repository's, its Omni settings'), naming both; an entry it only adds
// keeps the check green, and a repository with no other level grades exactly as today.
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import { makeRepo } from '../test/fixture.ts';
import type { Files, Repo } from '../test/fixture.ts';
import { main } from './omni.ts';

const K = '.omni-loop/knowledge';
const PLAN = '.omni-loop/local/tree/plan-repo';
const SETTINGS = '.omni-loop/local/tree/omni-settings';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n';

const PRINCIPLES = ['# Product principles', '', '## P-PRODUCT-1', '', 'Widgets are simple.', '', 'Why: people use them.', 'Decided: @ada, 2026-09-01', 'Source: PRD #3', ''].join('\n');
const INVARIANTS = ['# Product invariants', '', '## N-PRODUCT-1', '', 'A widget has an owner.', '', 'Source: PRD #3', 'Stated: 2026-09-01', 'Enforced by: kit/lib/widgets.test.ts', ''].join('\n');

/** A rules file holding one `BR-PRODUCT-<n>` per statement, numbered from 1, each well-formed. */
function rules(...statements: string[]): string {
  return [
    '# Product rules',
    '',
    ...statements.flatMap((statement, index) => [`## BR-PRODUCT-${index + 1}`, '', statement, '', 'Serves: P-PRODUCT-1', 'Source: PRD #3', 'Stated: 2026-09-01', 'Enforced by: kit/lib/widgets.test.ts', '']),
  ].join('\n');
}

/** A repository whose own knowledge folder grades green, holding `own` as its product rules. */
function repoFiles(...own: string[]): Files {
  return {
    '.omni-loop/config.yml': CONFIG,
    [`${K}/README.md`]: '# Knowledge\n',
    [`${K}/product/principles.md`]: PRINCIPLES,
    [`${K}/product/rules.md`]: rules(...own),
    [`${K}/product/invariants.md`]: INVARIANTS,
    'kit/lib/widgets.test.ts': 'test\n',
  };
}

const repos: Repo[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) rmSync(r.root, { recursive: true, force: true });
});

async function check(files: Files) {
  const r = makeRepo({ files, git: true });
  repos.push(r);
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['check', 'knowledge'], {
    cwd: r.root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    fetch: () => Promise.reject(new TypeError('a test never reaches the network')),
  });
  return { code, out: out.join(''), err: err.join('') };
}

const PASS = 'check knowledge — 1 principle(s), 2 rule(s), 1 invariant(s), 0 contract(s) across 0 domain(s) and 0 cross-domain file(s); 0 wish(es), 0 proposed.';

describe('omni check knowledge — the levels above the repository (PRD 2416)', () => {
  it('grades a repository with no other level exactly as today', async () => {
    const result = await check(repoFiles('A widget is blue.', 'A widget is named.'));
    expect(result.code).toBe(0);
    expect(result.out).toContain(PASS);
    expect(result.out).not.toContain('contradicts');
  });

  it('stays green when the repository only adds to its plan repository’s and its Omni settings’ rules', async () => {
    const result = await check({
      ...repoFiles('A widget is kept.', 'A widget is blue.'),
      [`${PLAN}/product/rules.md`]: rules('A widget is kept.'),
      [`${SETTINGS}/product/rules.md`]: rules('A  widget\nis kept.'),
    });
    expect(result.code).toBe(0);
    expect(result.out).toContain(PASS);
  });

  it('goes red on a repository rule that contradicts its plan repository’s, naming both entries and their levels', async () => {
    const result = await check({ ...repoFiles('A widget is red.', 'A widget is named.'), [`${PLAN}/product/rules.md`]: rules('A widget is blue.') });
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      `${K}/product/rules.md: BR-PRODUCT-1 [repo] contradicts BR-PRODUCT-1 [plan repo] in ${PLAN}/product/rules.md — ` +
        '"A widget is red." against "A widget is blue.": a level may add to the product knowledge above it, never change it — say it as the level above does, or give the new entry an id of its own.',
    );
    expect(result.out).not.toContain(PASS);
  });

  it('goes red on a repository rule that contradicts its Omni settings’, naming both', async () => {
    const result = await check({ ...repoFiles('A widget is red.', 'A widget is named.'), [`${SETTINGS}/product/rules.md`]: rules('A widget is blue.') });
    expect(result.code).toBe(1);
    expect(result.out).toContain(`${K}/product/rules.md: BR-PRODUCT-1 [repo] contradicts BR-PRODUCT-1 [omni settings] in ${SETTINGS}/product/rules.md — "A widget is red." against "A widget is blue."`);
  });

  it('goes red when the kind changes under the same id, naming both kinds', async () => {
    const cross = (kind: string) => ['# Gears and widgets', '', '## X-GEARS-WIDGETS-1', '', 'A gear turns a widget.', '', `Kind: ${kind}`, ''].join('\n');
    const result = await check({ ...repoFiles('A widget is blue.', 'A widget is named.'), [`${PLAN}/cross-domain/gears--widgets.md`]: cross('invariant') });
    // The repository holds no such entry: the plan repository's alone only adds.
    expect(result.out).not.toContain('contradicts');
    const red = await check({
      ...repoFiles('A widget is blue.', 'A widget is named.'),
      [`${SETTINGS}/cross-domain/gears--widgets.md`]: cross('invariant'),
      [`${PLAN}/cross-domain/gears--widgets.md`]: cross('rule'),
    });
    expect(red.code).toBe(1);
    expect(red.out).toContain(
      `${PLAN}/cross-domain/gears--widgets.md: X-GEARS-WIDGETS-1 [plan repo] contradicts X-GEARS-WIDGETS-1 [omni settings] in ${SETTINGS}/cross-domain/gears--widgets.md — a rule against an invariant:`,
    );
  });
});
