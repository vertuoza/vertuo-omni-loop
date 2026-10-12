// `omni check coverage` and the `omni status <prd> --base` gate read the knowledge folder at the
// range's base, so a law losing its proof fires `law-demoted` in the terminal as on the server
// (PRD 1342, s7).
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  return { out, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} } };
}

const INVARIANTS = '.omni-loop/knowledge/product/invariants.md';
const law = (enforcedBy: string) => `# Product invariants\n\n## N-PRODUCT-1\n\nA save writes one row.\n\nEnforced by: ${enforcedBy}\n`;

/** A repository whose base holds a proven law, and a commit on top that turns it unenforced. */
function demoted(laws: string) {
  const { root, write } = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nlaws:\n  source: ${laws}\n`,
      '.omni-loop/delivery/inbox/0007-widget/spec.md': '# Widget\n',
      [INVARIANTS]: law('app/save.test.mjs'),
      'app/save.test.mjs': "it('saves', () => {});\n",
    },
  });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  write(INVARIANTS, law('unenforced'));
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'demote'], { cwd: root });
  return { root, base };
}

describe('the terminal grades law-demoted against the knowledge folder at the base', () => {
  it('omni check coverage names it', async () => {
    const { root, base } = demoted('knowledge');
    const s = io();
    expect(await main(['check', 'coverage', '--base', base, '--prd', '7'], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toContain('law-demoted');
  });

  it('the omni status gate names it', async () => {
    const { root, base } = demoted('knowledge');
    const s = io();
    expect(await main(['status', '7', '--base', base], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toContain(`${INVARIANTS} (law-demoted)`);
  });

  it('neither names it when laws.source is not knowledge', async () => {
    const { root, base } = demoted('none');
    const s = io();
    await main(['status', '7', '--base', base], { cwd: root, ...s });
    expect(s.out.join('')).not.toContain('law-demoted');
  });
});
