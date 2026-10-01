import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const PRD = 7;
const DIR = `.omni-loop/delivery/inbox/0007-widgets`;
const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const CLAUDE = 'Co-Authored-By: Claude <noreply@anthropic.com>';

/** Commits everything, signed as a skill signs it (the session's trailer, then Omni-man's) unless
 * `signed` is false. Returns the commit's short sha. */
function commit(root, message, { signed = true } = {}) {
  const text = signed ? `${message}\n\n${CLAUDE}\n${TRAILER}\n` : message;
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', text], { cwd: root, stdio: 'ignore' });
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

/** A repo with one commit already holding its config (`base`), then a second commit the test adds
 * its own files to — so `git diff base...HEAD` names only what the test itself changed, never the
 * config file `makeRepo` writes. */
function setup(configText = CONFIG_TEXT) {
  const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': configText } });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, write, base };
}

/** The three files a phase-0 pull request carries for PRD 7. */
function writeDocs(write) {
  write(`${DIR}/spec.md`, '# spec\n');
  write(`${DIR}/plan.md`, '# plan\n');
  write(`${DIR}/before-after.html`, '<html></html>\n');
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

describe('omni phase0 — the signature (PRD #99, AC 6)', () => {
  it('a signed range is ok as before, and says it is signed', async () => {
    const { root, write, base } = setup();
    writeDocs(write);
    commit(root, 'docs(phase-0): widgets');

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toMatch(/^ok — docs-only, and it carries the spec, the plan and the before\/after/m);
    expect(out).toMatch(/^signed: yes$/m);
    expect(out).not.toMatch(/unsigned/);
  });

  it('a commit without the trailer is not ok, exit 1, naming the commit and the missing line', async () => {
    const { root, write, base } = setup();
    writeDocs(write);
    const unsigned = commit(root, 'docs(phase-0): widgets', { signed: false });

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    const out = s.out.join('');
    expect(out).toContain(`not ok — unsigned: ${unsigned} has no "${TRAILER}" line`);
    expect(out).toMatch(/^signed: no$/m);
    expect(out).toContain(`  - ${unsigned} docs(phase-0): widgets`);
    expect(out).toMatch(/^docs-only: yes$/m);
  });

  it('names only the unsigned commits of a range, oldest first', async () => {
    const { root, write, base } = setup();
    write(`${DIR}/spec.md`, '# spec\n');
    const first = commit(root, 'docs: the spec', { signed: false });
    write(`${DIR}/plan.md`, '# plan\n');
    commit(root, 'docs: the plan');
    write(`${DIR}/before-after.html`, '<html></html>\n');
    const third = commit(root, 'docs: the page', { signed: false });

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    const out = s.out.join('');
    expect(out).toContain(`not ok — unsigned: ${first}, ${third} have no "${TRAILER}" line`);
    expect(out.indexOf(`  - ${first} docs: the spec`)).toBeLessThan(out.indexOf(`  - ${third} docs: the page`));
    expect(out).not.toContain('docs: the plan');
  });

  it('a claude trailer alone, or Omni-man at another address, is not signed', async () => {
    const { root, write, base } = setup();
    writeDocs(write);
    commit(root, `docs(phase-0): widgets\n\n${CLAUDE}\nCo-authored-by: Omni-man <omniman@example.com>\n`, { signed: false });

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toMatch(/^not ok — unsigned: /m);
  });

  it('a commit signed OmniMan, his name before PRD #215, is no longer signed (its Decision 5)', async () => {
    const { root, write, base } = setup();
    writeDocs(write);
    const before = TRAILER.replace('Omni-man', 'OmniMan');
    const sha = commit(root, `docs(phase-0): widgets\n\n${CLAUDE}\n${before}\n`, { signed: false });

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toContain(`not ok — unsigned: ${sha} has no "${TRAILER}" line`);
  });

  it('reports every fault at once: an unsigned commit beside a missing plan', async () => {
    const { root, write, base } = setup();
    write(`${DIR}/spec.md`, '# spec\n');
    write(`${DIR}/before-after.html`, '<html></html>\n');
    const unsigned = commit(root, 'docs(phase-0): no plan', { signed: false });

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    const out = s.out.join('');
    expect(out).toContain(`not ok — nothing in it is the plan; unsigned: ${unsigned} has no "${TRAILER}" line`);
    expect(out).toMatch(/missing: plan/);
  });

  it('checks the trailer the config names, when it overrides the default', async () => {
    const { root, write, base } = setup(`${CONFIG_TEXT}signature:\n  name: Robo\n  email: robo@example.com\n`);
    writeDocs(write);
    commit(root, 'docs(phase-0): widgets');

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(1);
    expect(s.out.join('')).toContain('has no "Co-authored-by: Robo <robo@example.com>" line');
  });

  it('with signature: null the signature is not checked', async () => {
    const { root, write, base } = setup(`${CONFIG_TEXT}signature: null\n`);
    writeDocs(write);
    commit(root, 'docs(phase-0): widgets', { signed: false });

    const s = io();
    expect(await main(['phase0', String(PRD), '--base', base], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('');
    expect(out).toMatch(/^ok —/m);
    expect(out).toMatch(/^signed: off \(signature: null\)$/m);
  });
});
