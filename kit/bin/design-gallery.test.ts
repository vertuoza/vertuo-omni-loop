// `omni design gallery [--out <file>]` (PRD 1550, s3): one generated, self-contained page of the
// whole screen library, written outside the repository unless --out names a path there, never
// committed. On a fixture repository.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const ON = HEAD + 'design:\n  enabled: true\n';
const LIB = '.omni-loop/knowledge/design/screens';
const EDITOR = '---\nscreen: quote-editor\nstatus: locked\nlocked-by: "@ana"\nlocked-on: 2026-10-10\nquote: "build it"\nmock: quote-editor.html\nroutes: [/quotes/:id]\n---\n';
const LIST = '---\nscreen: quote-list\nstatus: draft\nroutes: [/quotes]\n---\n';
const OLD = '---\nscreen: old-editor\nstatus: superseded\n---\n';
const SHELL = '---\nscreen: app-shell\nstatus: draft\nkind: shared\nroutes: [/quotes, /quotes/:id]\n---\n';
const MOCK = '<main data-screen="quote-editor"><button data-primary>Send</button></main>';

async function gallery(root: string, args: string[] = []) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['design', 'gallery', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

function library(config = ON) {
  const repo = makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': config, [`${LIB}/old.md`]: OLD, [`${LIB}/shell.md`]: SHELL, [`${LIB}/list.md`]: LIST, [`${LIB}/editor.md`]: EDITOR, [`${LIB}/quote-editor.html`]: MOCK },
  });
  const status = () => execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: repo.root, encoding: 'utf8' });
  return { ...repo, status };
}

describe('omni design gallery', () => {
  it('writes one page of the library outside the repository, prints its path, and leaves the checkout clean', async () => {
    const { root, status } = library();
    const { code, out, err } = await gallery(root);
    expect({ code, err }).toEqual({ code: 0, err: '' });
    const path = out.trim();
    expect(isAbsolute(path)).toBe(true);
    expect(relative(root, path).startsWith('..')).toBe(true);
    const page = readFileSync(path, 'utf8');
    expect(page.indexOf('<h2>quote-editor</h2>')).toBeLessThan(page.indexOf('<h2>quote-list</h2>'));
    expect(page.indexOf('<h2>quote-list</h2>')).toBeLessThan(page.indexOf('<h2>old-editor</h2>'));
    expect(page.indexOf('<h2>old-editor</h2>')).toBeLessThan(page.indexOf('<h2 class="group">Shared screens</h2>'));
    expect(page.indexOf('<h2 class="group">Shared screens</h2>')).toBeLessThan(page.indexOf('<h2>app-shell</h2>'));
    expect(page).toContain('srcdoc="&lt;main data-screen=&quot;quote-editor&quot;&gt;');
    expect(page.match(/no mockup/g)).toHaveLength(3);
    expect(page).not.toMatch(/<script/i);
    expect(status()).toBe('');
  });

  it('writes where --out names, relative to the repository root', async () => {
    const elsewhere = join(mkdtempSync(join(tmpdir(), 'gallery-out-')), 'library.html');
    const { root } = library();
    expect(await gallery(root, ['--out', elsewhere])).toEqual({ code: 0, out: `${elsewhere}\n`, err: '' });
    expect(readFileSync(elsewhere, 'utf8')).toContain('<h2>quote-list</h2>');
    const inside = await gallery(root, ['--out', 'build/gallery.html']);
    expect({ code: inside.code, err: inside.err }).toEqual({ code: 0, err: '' });
    expect(inside.out).toMatch(/\/build\/gallery\.html\n$/);
    expect(readFileSync(join(root, 'build/gallery.html'), 'utf8')).toBe(readFileSync(inside.out.trim(), 'utf8'));
  });

  it('prints no screen yet and writes nothing for an empty library', async () => {
    const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': ON } });
    const out = join(mkdtempSync(join(tmpdir(), 'gallery-empty-')), 'g.html');
    expect(await gallery(repo.root, ['--out', out])).toEqual({ code: 0, out: 'no screen yet\n', err: '' });
    expect(existsSync(out)).toBe(false);
  });

  it('prints design: off and writes nothing while the flag is off', async () => {
    const { root } = library(HEAD);
    const out = join(mkdtempSync(join(tmpdir(), 'gallery-off-')), 'g.html');
    expect(await gallery(root, ['--out', out])).toEqual({ code: 0, out: 'design: off\n', err: '' });
    expect(existsSync(out)).toBe(false);
  });

  it('refuses an operand, as a usage mistake', async () => {
    const { root } = library();
    const { code, err } = await gallery(root, ['extra']);
    expect(code).toBe(2);
    expect(err).toContain('omni design gallery [--out <file>]');
  });
});
