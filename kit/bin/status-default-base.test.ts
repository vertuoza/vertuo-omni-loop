// `omni status <prd>` with no `--base` grades the range against `<repo.remote>/<repo.defaultBranch>`
// (#2999): a bare gate that graded no range passed a law change with no high item green, and an
// agent marked the feature PR ready on it.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  return { out, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => out.push(s) } };
}

const INVARIANTS = '.omni-loop/knowledge/product/invariants.md';
const PROOF = 'app/save.test.mjs';

/** A repository whose default branch holds a proven law, and a branch on top that changes its proof. */
function lawProofChanged() {
  const { root, write } = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: knowledge\n',
      '.omni-loop/delivery/inbox/0007-widget/spec.md': '# Widget\n',
      [INVARIANTS]: `# Product invariants\n\n## N-PRODUCT-1\n\nA save writes one row.\n\nEnforced by: ${PROOF}\n`,
      [PROOF]: "it('saves', () => {});\n",
    },
  });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  write(PROOF, "it('saves once', () => {});\n");
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'change the proof'], { cwd: root });
  return { root, base };
}

describe('the omni status gate with no --base', () => {
  it('grades the range against the default branch, so a law change with no item is red', async () => {
    const { root, base } = lawProofChanged();
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', base], { cwd: root });
    const s = io();
    expect(await main(['status', '7'], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toContain(`${PROOF} (law-proof)`);
  });

  it('refuses, naming the base, when the default branch cannot be read, never a green on no range', async () => {
    const { root } = lawProofChanged();
    const s = io();
    expect(await main(['status', '7'], { cwd: root, ...s })).toBe(2);
    expect(s.out.join('')).toContain('Cannot read origin/main');
  });

  it('is green on the same branch once the default branch is the branch itself', async () => {
    const { root } = lawProofChanged();
    execFileSync('git', ['update-ref', 'refs/remotes/origin/main', 'HEAD'], { cwd: root });
    const s = io();
    expect(await main(['status', '7'], { cwd: root, ...s })).toBe(0);
  });
});
