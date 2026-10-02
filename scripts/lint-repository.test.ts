// `pnpm lint` at zero (PRD 976), proven on fixtures: the linter is replaced by one that returns the
// fixture's findings, so the verdict is read without running ESLint. A single finding anywhere fails,
// no finding passes, and `pnpm lint <prefix>…` lints only the tracked files under those prefixes.
import { describe, expect, it } from 'vitest';
import { type Finding, type Linter, lintRepository } from './lint-repository.ts';

const tracked = ['kit/bin/omni.ts', 'kit/lib/narrow.ts', 'apps/galaxy/src/App.tsx', 'scripts/lint.ts'];

/** A linter that reports `findings`, and records the files it was handed. */
function fixture(findings: Finding[]): { lint: Linter; handed: string[][] } {
  const handed: string[][] = [];
  const lint: Linter = (files) => {
    handed.push([...files]);
    return Promise.resolve({ findings, text: findings.map((f) => `${f.path}:${String(f.line)} ${f.rule}`).join('\n') });
  };
  return { lint, handed };
}

describe('pnpm lint, on fixtures', () => {
  it('passes with no finding at all, linting every tracked file', async () => {
    const { lint, handed } = fixture([]);
    const verdict = await lintRepository([], { tracked: () => tracked, lint });
    expect(verdict.exitCode).toBe(0);
    expect(handed).toEqual([tracked]);
    expect(verdict.report).toContain('pnpm lint: 0 findings in 4 files');
  });

  it('fails on a single finding, naming it', async () => {
    const { lint } = fixture([{ path: 'kit/lib/narrow.ts', line: 7, rule: '@typescript-eslint/no-non-null-assertion' }]);
    const verdict = await lintRepository([], { tracked: () => tracked, lint });
    expect(verdict.exitCode).toBe(1);
    expect(verdict.report).toContain('kit/lib/narrow.ts:7 @typescript-eslint/no-non-null-assertion');
    expect(verdict.report).toContain('     1  @typescript-eslint/no-non-null-assertion');
    expect(verdict.report).toContain('pnpm lint: 1 findings in 4 files');
  });

  it('lints only the tracked files under the prefixes it is given, and fails the same way', async () => {
    const { lint, handed } = fixture([{ path: 'kit/bin/omni.ts', line: 3, rule: '@typescript-eslint/require-await' }]);
    const verdict = await lintRepository(['kit/', 'scripts/'], { tracked: () => tracked, lint });
    expect(handed).toEqual([['kit/bin/omni.ts', 'kit/lib/narrow.ts', 'scripts/lint.ts']]);
    expect(verdict.exitCode).toBe(1);
    expect(verdict.report).toContain('pnpm lint: 1 findings in 3 files');
  });
});
