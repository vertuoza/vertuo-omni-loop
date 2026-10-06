// `pnpm mutation:changed` (PRD 1072), proven on fixture repositories: which files it would mutate, and
// the line it ends with. The plan is tested, not the run: nothing here starts Stryker.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../kit/test/fixture.ts';
import { changedFiles, mergeBase } from './check-changed-steps.ts';
import { changedSummary, corePatterns, isCoreFile, mutationArgs, planMutation } from './mutation-changed-plan.ts';
import { parseReport } from './mutation-report.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const core = {
  'kit/lib/ids.ts': 'export const a = 1;\n',
  'kit/lib/ids.test.ts': 'export {};\n',
  'kit/lib/outbox/gate/rank.ts': 'export const r = 1;\n',
  'kit/lib/playbook/forms.ts': 'export const f = 1;\n',
  'kit/bin/omni.ts': 'export {};\n',
  'README.md': '# readme\n',
};

/** A fixture repository holding `core` on `main`, on a branch `work` cut from it. */
function repo() {
  const fixture = makeRepo({ files: core, git: true });
  roots.push(fixture.root);
  execFileSync('git', ['checkout', '-q', '-b', 'work'], { cwd: fixture.root });
  return fixture;
}

describe('the delivery core', () => {
  it('is what stryker.config.ts mutates: the core modules, never a test', () => {
    expect(isCoreFile('kit/lib/ids.ts', corePatterns)).toBe(true);
    expect(isCoreFile('kit/lib/outbox/gate/rank.ts', corePatterns)).toBe(true);
    expect(isCoreFile('kit/lib/env/read.ts', corePatterns)).toBe(true);
    expect(isCoreFile('kit/lib/ids.test.ts', corePatterns)).toBe(false);
    expect(isCoreFile('kit/lib/outbox/gate/rank.test.ts', corePatterns)).toBe(false);
    expect(isCoreFile('kit/lib/playbook/forms.ts', corePatterns)).toBe(false);
    expect(isCoreFile('kit/bin/omni.ts', corePatterns)).toBe(false);
  });
});

describe('the files mutation:changed mutates', () => {
  it('none when no core file changed: it says so and runs nothing', () => {
    const { root, write } = repo();
    write('README.md', '# changed\n');
    write('kit/lib/playbook/forms.ts', 'export const f = 2;\n');
    const base = mergeBase(root, 'main');
    expect(planMutation(changedFiles(root, base), corePatterns)).toEqual([]);
  });

  it('exactly the changed core files, committed, uncommitted or new, never a test or a deleted file', () => {
    const { root, write } = repo();
    write('kit/lib/ids.ts', 'export const a = 2;\n');
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'change'], { cwd: root });
    write('kit/lib/ids.test.ts', 'export const t = 1;\n');
    write('kit/lib/inbox/new.ts', 'export const n = 1;\n');
    write('kit/lib/playbook/forms.ts', 'export const f = 2;\n');
    rmSync(`${root}/kit/lib/outbox/gate/rank.ts`);
    const base = mergeBase(root, 'main');
    expect(planMutation(changedFiles(root, base), corePatterns)).toEqual(['kit/lib/ids.ts', 'kit/lib/inbox/new.ts']);
  });

  it('runs Stryker on those files alone, with the repository’s config', () => {
    expect(mutationArgs(['kit/lib/ids.ts', 'kit/lib/inbox/new.ts'])).toEqual(['exec', 'stryker', 'run', 'stryker.config.ts', '--mutate', 'kit/lib/ids.ts,kit/lib/inbox/new.ts']);
  });
});

describe('the line it ends with', () => {
  const report = parseReport({
    files: {
      'kit/lib/ids.ts': {
        mutants: [
          { mutatorName: 'Regex', status: 'Killed', location: { start: { line: 3, column: 1 } } },
          { mutatorName: 'Regex', status: 'Timeout', location: { start: { line: 3, column: 1 } } },
          { mutatorName: 'Regex', status: 'Survived', replacement: '/a/', location: { start: { line: 9, column: 1 } } },
          { mutatorName: 'Regex', status: 'CompileError', location: { start: { line: 9, column: 1 } } },
        ],
      },
      'kit/lib/inbox/new.ts': { mutants: [{ mutatorName: 'StringLiteral', status: 'NoCoverage', replacement: '""', location: { start: { line: 1, column: 1 } } }] },
      'kit/lib/board.ts': { mutants: [{ mutatorName: 'StringLiteral', status: 'Survived', location: { start: { line: 1, column: 1 } } }] },
    },
  });

  it('counts the mutated files only: killed (timeouts included), then survived (no coverage included)', () => {
    const lines = changedSummary(report, ['kit/lib/ids.ts', 'kit/lib/inbox/new.ts']);
    expect(lines.at(-1)).toBe('mutation: 2 killed, 2 survived in kit/lib/ids.ts, kit/lib/inbox/new.ts');
  });

  it('lists each mutant the tests let through, with its file and line, before it', () => {
    const lines = changedSummary(report, ['kit/lib/ids.ts', 'kit/lib/inbox/new.ts']);
    expect(lines.slice(0, -1)).toEqual(['- kit/lib/ids.ts:9 Regex → /a/ (survived)', '- kit/lib/inbox/new.ts:1 StringLiteral → "" (no coverage)']);
  });
});
