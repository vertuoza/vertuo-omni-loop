import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { rangeChanges } from './git.mjs';

describe('rangeChanges', () => {
  it('reports a renamed file as a delete and an add, never an R', () => {
    const { root, ctx } = makeRepo({ git: true, files: { 'a.test.mjs': 'it("x", () => {});\n' } });
    const git = (...args) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: root, stdio: 'ignore' });
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
