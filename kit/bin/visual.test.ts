// @ts-nocheck
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG_TEXT = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const ISSUE = 12;
const DIR = '.omni-loop/delivery/visual/0012-sidebar-darker';
const PAGE = `${DIR}/before-after.html`;
const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const CLAUDE = 'Co-Authored-By: Claude <noreply@anthropic.com>';
const VALID_PAGE = '<!doctype html><title>Sidebar</title><img src="data:image/svg+xml;base64,PHN2Zy8+">\n';

/** Commits everything, signed as a skill signs it unless `signed` is false. Returns the short sha. */
function commit(root, message, { signed = true } = {}) {
  const text = signed ? `${message}\n\n${CLAUDE}\n${TRAILER}\n` : message;
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', text], { cwd: root, stdio: 'ignore' });
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

/** A repository whose config is already committed (`base`), standing in for the default branch. */
function setup(configText = CONFIG_TEXT) {
  const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': configText } });
  const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, write, base };
}

async function run(root, base, issue = ISSUE) {
  const s = io();
  const code = await main(['visual', String(issue), '--base', base], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

/** The lines after `not ok` that name a failed check. */
function failures(out) {
  return out.split('\n').filter((line) => line.startsWith('- '));
}

describe('omni visual', () => {
  it('is ok, exit 0, for one folder holding a valid page and every commit signed', async () => {
    const { root, write, base } = setup();
    write('app/styles.css', 'aside { background: #222; }\n');
    write(PAGE, VALID_PAGE);
    commit(root, 'fix(app): sidebar darker (#12)');

    const { code, out } = await run(root, base);
    expect(code).toBe(0);
    expect(out).toMatch(/^ok$/m);
    expect(out).not.toMatch(/not ok/);
    expect(failures(out)).toEqual([]);
  });

  it('is not ok, exit 1, when no folder is there for the issue', async () => {
    const { root, write, base } = setup();
    write('.omni-loop/delivery/visual/0013-other/before-after.html', VALID_PAGE);
    commit(root, 'fix(app): other');

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(out).toMatch(/^not ok$/m);
    expect(failures(out)).toHaveLength(1);
    expect(failures(out)[0]).toMatch(/no folder .*\.omni-loop\/delivery\/visual\/0012-/);
  });

  it('is not ok, exit 1, when two folders are there for the issue', async () => {
    const { root, write, base } = setup();
    write(PAGE, VALID_PAGE);
    write('.omni-loop/delivery/visual/0012-other/before-after.html', VALID_PAGE);
    commit(root, 'fix(app): sidebar darker (#12)');

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(1);
    expect(failures(out)[0]).toMatch(/2 folders/);
    expect(failures(out)[0]).toContain('0012-other');
    expect(failures(out)[0]).toContain('0012-sidebar-darker');
  });

  it('is not ok, exit 1, when the folder holds no before-after.html', async () => {
    const { root, write, base } = setup();
    write(`${DIR}/variations-r1.html`, VALID_PAGE);
    commit(root, 'fix(app): sidebar darker (#12)');

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${PAGE}: missing.`]);
  });

  it('is ok with the rounds of variations beside the page, and names a stray file (PRD 627)', async () => {
    const { root, write, base } = setup();
    write(PAGE, VALID_PAGE);
    write(`${DIR}/variations-r1.html`, VALID_PAGE);
    write(`${DIR}/variations-r2.html`, VALID_PAGE);
    commit(root, 'fix(app): sidebar darker (#12)');
    expect((await run(root, base)).code).toBe(0);

    write(`${DIR}/notes.md`, 'notes\n');
    commit(root, 'docs(app): notes (#12)');
    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- ${DIR}/notes.md: not part of a visual fix; the folder holds before-after.html and variations-r<k>.html only.`]);
  });

  it('is not ok, exit 1, when the page is over limits.beforeAfterMaxBytes', async () => {
    const { root, write, base } = setup(`${CONFIG_TEXT}limits:\n  beforeAfterMaxBytes: 50\n`);
    write(PAGE, `${VALID_PAGE}${'x'.repeat(60)}`);
    commit(root, 'fix(app): sidebar darker (#12)');

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(1);
    expect(failures(out)[0]).toMatch(/over the 50-byte cap/);
  });

  it.each([
    ['png', 'data:image/png;base64,iVBORw0KGgo='],
    ['jpeg', 'data:image/jpeg;base64,/9j/4AAQ'],
  ])('is not ok, exit 1, when the page holds a base64 %s image', async (_kind, url) => {
    const { root, write, base } = setup();
    write(PAGE, `<!doctype html><img src="${url}">\n`);
    commit(root, 'fix(app): sidebar darker (#12)');

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(1);
    expect(failures(out)[0]).toMatch(/base64 raster image/);
  });

  it('is not ok, exit 1, naming the unsigned commit', async () => {
    const { root, write, base } = setup();
    write(PAGE, VALID_PAGE);
    const sha = commit(root, 'fix(app): sidebar darker (#12)', { signed: false });

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toEqual([`- unsigned: ${sha} fix(app): sidebar darker (#12) has no "${TRAILER}" line.`]);
  });

  it('names every failure at once', async () => {
    const { root, write, base } = setup();
    write(PAGE, '<img src="data:image/png;base64,iVBOR">\n');
    commit(root, 'fix(app): sidebar darker (#12)', { signed: false });

    const { code, out } = await run(root, base);
    expect(code).toBe(1);
    expect(failures(out)).toHaveLength(2);
  });

  it('does not check the signature with signature: null', async () => {
    const { root, write, base } = setup(`${CONFIG_TEXT}signature: null\n`);
    write(PAGE, VALID_PAGE);
    commit(root, 'fix(app): sidebar darker (#12)', { signed: false });

    expect((await run(root, base)).code).toBe(0);
  });

  it('refuses a --base that does not resolve, exit 2', async () => {
    const { root } = setup();
    const { code, err } = await run(root, 'nope-ref');
    expect(code).toBe(2);
    expect(err).toMatch(/nope-ref/);
  });

  it('refuses an issue that is not a positive integer, exit 2', async () => {
    const { root, base } = setup();
    expect((await run(root, base, 'twelve')).code).toBe(2);
  });

  it('exits 2 outside an installed repository', async () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-bare-'));
    const s = io();
    expect(await main(['visual', String(ISSUE)], { cwd: root, ...s })).toBe(2);
  });
});
