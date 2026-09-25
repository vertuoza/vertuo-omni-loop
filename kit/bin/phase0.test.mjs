import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const PRD = 7;
const DIR = `.omni-loop/delivery/inbox/0007-widgets`;

function commit(root, message) {
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', message], { cwd: root, stdio: 'ignore' });
}

/** A repo with one commit already holding its config (`base`), then a second commit the test adds
 * its own files to — so `git diff base...HEAD` names only what the test itself changed, never the
 * config file `makeRepo` writes. */
function setup() {
  const { root, write } = makeRepo({ git: true, files: CONFIG });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, write, base };
}

describe('omni phase0', () => {
  it('is ok, exit 0, docs-only carrying spec, plan and before/after', async () => {
    const { root, write, base } = setup();
    write(`${DIR}/spec.md`, '# spec\n');
    write(`${DIR}/plan.md`, '# plan\n');
    write(`${DIR}/before-after.html`, '<html></html>\n');
    commit(root, 'phase-0 docs');

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toMatch(/^ok —/m);
    expect(out).toMatch(/docs-only: yes/);
    expect(out).toMatch(new RegExp(`spec:.*${DIR}/spec\\.md`.replace(/\//g, '\\/')));
  });

  it('is not ok, exit 1, when the plan is missing', async () => {
    const { root, write, base } = setup();
    write(`${DIR}/spec.md`, '# spec\n');
    write(`${DIR}/before-after.html`, '<html></html>\n');
    commit(root, 'phase-0 docs, no plan');

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    const out = s.out.join('');
    expect(out).toMatch(/^not ok —/m);
    expect(out).toMatch(/missing: plan/);
  });

  it('is not ok, exit 1, when the diff carries a source file', async () => {
    const { root, write, base } = setup();
    write(`${DIR}/spec.md`, '# spec\n');
    write(`${DIR}/plan.md`, '# plan\n');
    write(`${DIR}/before-after.html`, '<html></html>\n');
    write('kit/lib/foo.mjs', 'export const x = 1;\n');
    commit(root, 'phase-0 docs plus code');

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    const out = s.out.join('');
    expect(out).toMatch(/docs-only: no/);
    expect(out).toMatch(/kit\/lib\/foo\.mjs/);
  });

  it('refuses a --base that does not resolve, one line, exit 2', async () => {
    const { root } = setup();
    const s = io();
    expect(await main(['phase0', String(PRD), '--base', 'nope-ref'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('').split('\n').filter(Boolean)).toHaveLength(1);
    expect(s.err.join('')).toMatch(/nope-ref/);
  });

  it('defaults --base to <repo.remote>/<repo.defaultBranch>, refusing when it is absent', async () => {
    const { root } = setup();
    const s = io();
    expect(await main(['phase0', String(PRD)], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/origin\/main/);
  });
});
