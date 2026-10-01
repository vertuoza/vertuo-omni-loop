import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { parseNameStatus, rangeChanges } from './git.ts';
import { parseNameStatus as coverageParse } from './outbox/check-decision-coverage.ts';
import { parseNameStatus as commentParse } from './outbox/comment.ts';

describe('rangeChanges', () => {
  it('reports a renamed file as a delete and an add, never an R', () => {
    const { root, ctx } = makeRepo({ git: true, files: { 'a.test.mjs': 'it("x", () => {});\n' } });
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
    git('checkout', '-q', '-b', 'feature');
    git('mv', 'a.test.mjs', 'b.test.mjs');
    git('commit', '-q', '-m', 'rename');
    const changes = rangeChanges({ ctx, base: 'main' });
    expect(changes).toEqual(
      expect.arrayContaining([
        { path: 'a.test.mjs', status: 'D' },
        { path: 'b.test.mjs', status: 'A' },
      ]),
    );
    expect(changes).toHaveLength(2);
  });
});

describe('parseNameStatus', () => {
  it('is one implementation, re-exported by the coverage and comment modules', () => {
    expect(parseNameStatus('M\ta.md\nA\tb.md\n')).toEqual([{ status: 'M', path: 'a.md' }, { status: 'A', path: 'b.md' }]);
    expect(coverageParse).toBe(parseNameStatus);
    expect(commentParse).toBe(parseNameStatus);
  });
});
