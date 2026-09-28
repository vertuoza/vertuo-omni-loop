import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { trackedFiles } from './check-report.mjs';

const commit = (root) => {
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'files'], {
    cwd: root,
    stdio: 'ignore',
  });
};

describe('trackedFiles', () => {
  it('lists every tracked file, sorted, when git ls-files prints more than 1 MB', () => {
    const { root, ctx } = makeRepo({ git: true });
    const folder = `deep/${'a'.repeat(90)}/${'b'.repeat(90)}`;
    mkdirSync(join(root, folder), { recursive: true });
    const expected = [];
    for (let i = 0; i < 6000; i += 1) {
      const path = `${folder}/file-${String(i).padStart(5, '0')}.md`;
      writeFileSync(join(root, path), '');
      expected.push(path);
    }
    commit(root);
    expect(expected.reduce((bytes, path) => bytes + path.length + 1, 0)).toBeGreaterThan(1_048_576);

    const files = trackedFiles(ctx);
    expect(files).toHaveLength(6000);
    expect(files).toEqual([...expected].sort());
  }, 60_000);

  it('returns a path with a space and a non-ASCII character exactly as written', () => {
    const { ctx } = makeRepo({ git: true, files: { 'notes/café plan.md': '# plan\n', 'a.md': '' } });
    expect(trackedFiles(ctx)).toEqual(['a.md', 'notes/café plan.md']);
  });

  it('lists only the given folder, not a sibling sharing its prefix', () => {
    const { ctx } = makeRepo({
      git: true,
      files: { 'docs/a.md': '', 'docs/sub/b.md': '', 'docs-old/c.md': '', 'top.md': '' },
    });
    expect(trackedFiles(ctx, 'docs')).toEqual(['docs/a.md', 'docs/sub/b.md']);
  });

  it('returns nothing for a folder git tracks nothing in', () => {
    const { ctx } = makeRepo({ git: true, files: { 'top.md': '' } });
    expect(trackedFiles(ctx, 'missing')).toEqual([]);
  });
});
