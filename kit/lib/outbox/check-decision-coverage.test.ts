import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { testContext } from '../../test/fixture.ts';
import type { Context } from '../context.ts';
import { flatCtx as untypedFlatCtx } from '../../test/flat-layout.ts';

/** The flat test layout's context, typed as the kit's own (it carries every field the code reads). */
const flatCtx = (root: string, overrides: Record<string, unknown> = {}): Context =>
  untypedFlatCtx(root, overrides) as unknown as Context;
import { rangeChanges } from '../git.ts';
import { riskyChanges } from './decision-coverage.ts';
import {
  describeUnaccounted,
  discoveredPrds,
  findFormatViolations,
  gradePrd,
  parseNameStatus,
} from './check-decision-coverage.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'check-decision-coverage-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function accountText({ frontMatter = {}, body }: { frontMatter?: Record<string, string>; body?: string } = {}) {
  const fm = { prd: '1044', slice: 's2', graded: '2026-09-23', ...frontMatter };
  const fmLines = Object.entries(fm).map(([key, value]) => `${key}: ${value}`);
  return ['---', ...fmLines, '---', '', body].join('\n');
}

function seedAccount(prd: string | number, slice: string, text: string) {
  const dir = join(root, 'docs/outbox', String(prd), 'accounts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slice}.md`), text);
}

describe('parseNameStatus', () => {
  it('parses git diff --name-status output into { path, status } pairs', () => {
    expect(
      parseNameStatus(['M\tpackage.json', 'A\tscripts/check-decision-coverage.mjs', ''].join('\n')),
    ).toEqual([
      { status: 'M', path: 'package.json' },
      { status: 'A', path: 'scripts/check-decision-coverage.mjs' },
    ]);
  });

  it('ignores blank lines', () => {
    expect(parseNameStatus('\n\n')).toEqual([]);
  });
});

describe('discoveredPrds', () => {
  it('returns [] when the outbox tree does not exist at all', () => {
    expect(discoveredPrds({ ctx: flatCtx(root) })).toEqual([]);
  });

  it('lists only numeric-named directories, as PRD numbers, sorted', () => {
    mkdirSync(join(root, 'docs/outbox/1044'), { recursive: true });
    mkdirSync(join(root, 'docs/outbox/985'), { recursive: true });
    writeFileSync(join(root, 'docs/outbox/README.md'), '# not a prd\n');
    expect(discoveredPrds({ ctx: flatCtx(root) })).toEqual([985, 1044]);
  });
});

describe('findFormatViolations — every account file, whatever the PRD', () => {
  it('is empty when no account file exists anywhere', () => {
    expect(findFormatViolations({ ctx: flatCtx(root) })).toEqual([]);
  });

  it('names a malformed account by file, across PRDs', () => {
    seedAccount(1044, 's3', 'not even front matter\n');
    const violations = findFormatViolations({ ctx: flatCtx(root) });
    expect(
      violations.some((message) => message.includes('docs/outbox/1044/accounts/s3.md')),
    ).toBe(true);
    expect(violations.some((message) => message.includes('missing a front-matter block'))).toBe(
      true,
    );
  });

  it('is unaffected by a well-formed account', () => {
    const body = [
      '## Risky changes',
      '',
      '- `docs/knowledge/product/invariants.md`',
      '  law-text',
      '  spec the plan says so',
      '',
    ].join('\n');
    seedAccount(1044, 's3', accountText({ body }));
    expect(findFormatViolations({ ctx: flatCtx(root) })).toEqual([]);
  });
});

describe('gradePrd', () => {
  const risky = [
    { path: 'libs/vertuo-ai-credit/src/server/migrations.ts', status: 'M', rule: 'stored-shape' },
  ];

  it('a risky change with no account anywhere is unaccounted, and the printed line names path and rule', () => {
    const result = gradePrd(1044, risky, { ctx: flatCtx(root) });
    expect(result.malformed).toEqual([]);
    expect(result.accounted).toEqual([]);
    expect(result.unaccounted).toEqual(risky);
    expect(result.stale).toEqual([]);

    const line = describeUnaccounted(1044, result.unaccounted[0]);
    expect(line).toContain('libs/vertuo-ai-credit/src/server/migrations.ts');
    expect(line).toContain('stored-shape');
  });

  it('a risky change named by an account is accounted for', () => {
    const body = [
      '## Risky changes',
      '',
      '- `libs/vertuo-ai-credit/src/server/migrations.ts`',
      '  stored-shape',
      '  spec Solution, §2 — The account.',
      '',
    ].join('\n');
    seedAccount(1044, 's3', accountText({ body }));
    const result = gradePrd(1044, risky, { ctx: flatCtx(root) });
    expect(result.accounted).toEqual(risky);
    expect(result.unaccounted).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('an account for a path/rule the range never touched is stale, not unaccounted or fatal', () => {
    const body = [
      '## Risky changes',
      '',
      '- `some/other/path.ts`',
      '  stored-shape',
      '  spec no longer touched after a rebase',
      '',
    ].join('\n');
    seedAccount(1044, 's3', accountText({ body }));
    const result = gradePrd(1044, risky, { ctx: flatCtx(root) });
    expect(result.unaccounted).toEqual(risky);
    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].path).toBe('some/other/path.ts');
  });

  it('a malformed account is refused by name and never silently compared', () => {
    seedAccount(1044, 's3', 'not even front matter\n');
    const result = gradePrd(1044, risky, { ctx: flatCtx(root) });
    expect(result.malformed).toEqual([expect.stringContaining('docs/outbox/1044/accounts/s3.md')]);
    // The malformed file's entries never reach compare(); the risky change is still unaccounted.
    expect(result.unaccounted).toEqual(risky);
  });

  it('nothing risky and nothing accounted is entirely green', () => {
    const result = gradePrd(1044, [], { ctx: flatCtx(root) });
    expect(result).toEqual({
      prd: 1044,
      malformed: [],
      accounted: [],
      unaccounted: [],
      stale: [],
    });
  });
});

/**
 * `rangeChanges` (`kit/lib/git.ts`) against a real repository — the three-dot property this task
 * relies on for the same reason a check-openapi-label-style guard would: merging the default
 * branch in must not widen what a branch's own range holds.
 */
describe('rangeChanges, on a real repository', () => {
  let repo: string;
  let ctx: Context;
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  function write(path: string, content: string) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), content);
  }

  function commit(message: string) {
    git(['add', '-A']);
    git(['commit', '-q', '-m', message]);
  }

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'check-decision-coverage-repo-'));
    ctx = testContext(repo) as unknown as Context;
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);
    git(['config', 'commit.gpgsign', 'false']);
    write('README.md', '# fixture\n');
    commit('initial');
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    git(['checkout', '-q', '-b', 'feature']);
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('ordinary work is not risky, and with no account file anywhere the grade is green', () => {
    write('apps/vertuo-ai-api/src/foo.service.ts', 'export const foo = 1;\n');
    commit('ordinary change');
    const changes = rangeChanges({ ctx, base: 'origin/main' });
    expect(changes).toEqual([{ status: 'A', path: 'apps/vertuo-ai-api/src/foo.service.ts' }]);
    expect(riskyChanges(changes, { ctx })).toEqual([]);

    const result = gradePrd(1044, riskyChanges(changes, { ctx }), { ctx });
    expect(result).toEqual({ prd: 1044, malformed: [], accounted: [], unaccounted: [], stale: [] });
  });

  it('a range touching the published OpenAPI snapshot flags nothing — that ground is a different guard\'s', () => {
    write('apps/vertuoza-rest-api/openapi/v0.53.0-alpha.json', '{"version":"0.53.0-alpha"}\n');
    commit('cut a snapshot');
    const changes = rangeChanges({ ctx, base: 'origin/main' });
    expect(changes).toEqual([
      { status: 'A', path: 'apps/vertuoza-rest-api/openapi/v0.53.0-alpha.json' },
    ]);
    // decision-coverage's own five rules never fire on a path this repository's risk config never names.
    expect(riskyChanges(changes, { ctx })).toEqual([]);
  });

  it('a merge of main widens nothing (the three-dot property)', () => {
    write('apps/vertuo-ai-api/src/foo.service.ts', 'export const foo = 1;\n');
    commit('feature change');

    git(['checkout', '-q', 'main']);
    write('README.md', '# fixture, updated\n');
    commit('unrelated main change');
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    git(['checkout', '-q', 'feature']);
    git(['merge', '-q', '--no-edit', 'main']);

    expect(rangeChanges({ ctx, base: 'origin/main' })).toEqual([
      { status: 'A', path: 'apps/vertuo-ai-api/src/foo.service.ts' },
    ]);
  });

  it('throws when the base cannot be read, rather than grading nothing silently', () => {
    git(['update-ref', '-d', 'refs/remotes/origin/main']);
    expect(() => rangeChanges({ ctx, base: 'origin/main' })).toThrow(/Cannot read origin\/main/);
  });
});
