// `omni design touched [<base>]` (PRD 1369): whether the branch's diff touches a screen, on a
// temporary git repository. It only reports: every answer exits 0.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const ON = 'design:\n  enabled: true\n  paths: [src/ui/**, "**/*.css"]\n';
const FILES = { 'src/ui/Button.tsx': 'a', 'src/api/route.ts': 'b', 'styles/global.css': 'c', 'README.md': 'd' };

/** A fixture repository on `main` with the config given, then a branch `branch` changing `changed`. */
function repoChanging(config: string, changed: readonly string[], branch = 'work') {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, ...FILES } });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo.root, stdio: 'ignore' });
  git('checkout', '-q', '-b', branch);
  for (const path of changed) repo.write(path, `changed ${path}`);
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'change');
  return { ...repo, git };
}

async function touched(root: string, args: string[] = []) {
  const s = io();
  const code = await main(['design', 'touched', ...args], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni design touched', () => {
  it('prints design: off and exits 0 while design.enabled is false, reading no diff', async () => {
    const { root } = repoChanging(HEAD + 'design:\n  paths: [src/ui/**]\n', ['src/ui/Button.tsx']);
    expect(await touched(root, ['main'])).toEqual({ code: 0, out: 'design: off\n', err: '' });
    expect(await touched(root, ['no-such-ref'])).toEqual({ code: 0, out: 'design: off\n', err: '' });
  });

  it('prints ui: yes and each matching path, in the diff order, for a diff that touches design.paths', async () => {
    const { root } = repoChanging(HEAD + ON, ['src/ui/Button.tsx', 'src/api/route.ts', 'styles/global.css']);
    expect(await touched(root, ['main'])).toEqual({ code: 0, out: 'ui: yes\n  src/ui/Button.tsx\n  styles/global.css\n', err: '' });
  });

  it('prints ui: no for a diff that touches none of design.paths', async () => {
    const { root } = repoChanging(HEAD + ON, ['src/api/route.ts', 'README.md']);
    expect(await touched(root, ['main'])).toEqual({ code: 0, out: 'ui: no\n', err: '' });
  });

  it('prints ui: unknown when design.paths is empty', async () => {
    const { root } = repoChanging(HEAD + 'design:\n  enabled: true\n', ['src/ui/Button.tsx']);
    const { code, out } = await touched(root, ['main']);
    expect(code).toBe(0);
    expect(out).toBe('ui: unknown\ndesign.paths is empty: judge from the diff whether a screen changed\n');
  });

  it('reads the diff from the merge base: what the base gained since does not count', async () => {
    const { root, git, write } = repoChanging(HEAD + ON, ['src/api/route.ts']);
    git('checkout', '-q', 'main');
    write('src/ui/Button.tsx', 'moved on main');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-am', 'main moves');
    git('checkout', '-q', 'work');
    expect((await touched(root, ['main'])).out).toBe('ui: no\n');
  });

  it("defaults the base to the slice's feature branch on a slice branch, else to the default branch", async () => {
    const { root, git } = repoChanging(HEAD + ON, ['src/ui/Button.tsx'], 'feat/shop');
    git('checkout', '-q', '-b', 'feat/shop--s2');
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'slice');
    git('update-ref', 'refs/remotes/origin/main', 'main');
    git('update-ref', 'refs/remotes/origin/feat/shop', 'feat/shop');
    expect((await touched(root)).out).toBe('ui: no\n');
    git('checkout', '-q', 'feat/shop');
    expect((await touched(root)).out).toBe('ui: yes\n  src/ui/Button.tsx\n');
  });

  it('prints ui: unknown naming the base, and exits 0, when git cannot read the base', async () => {
    const { root } = repoChanging(HEAD + ON, ['src/ui/Button.tsx']);
    const named = await touched(root, ['nope']);
    expect(named.code).toBe(0);
    expect(named.out).toMatch(/^ui: unknown\ncannot read nope — fetch it or pass another base\n$/);
    const fallback = await touched(root);
    expect(fallback.code).toBe(0);
    expect(fallback.out).toMatch(/^ui: unknown\ncannot read origin\/main — fetch it or pass another base\n$/);
  });

  it('is explained by omni help design: the form, the flag, the check, and that nothing blocks', async () => {
    const { root } = repoChanging(HEAD, []);
    const overview = io();
    expect(await main(['help'], { cwd: root, ...overview })).toBe(0);
    const text = overview.out.join('');
    expect(text.slice(text.indexOf('Run by the skills:'))).toMatch(/\bdesign\b/);
    const s = io();
    expect(await main(['help', 'design'], { cwd: root, ...s })).toBe(0);
    const out = s.out.join('').replace(/\s+/g, ' ');
    expect(out).toMatch(/^omni design touched \[<base>\] +run by the skills /);
    for (const words of ['omni kb show design', 'design.enabled', 'design.paths', 'commands.design', 'design: off', 'ui: yes', 'ui: no', 'ui: unknown', 'the product wins', 'never blocks', 'exits 0']) {
      expect(out).toContain(words);
    }
  });

  it('stops with exit 2 on a verb it does not know, or two bases', async () => {
    const { root } = repoChanging(HEAD + ON, []);
    const s = io();
    expect(await main(['design'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toMatch(/usage: omni design touched \[<base>\]/);
    expect(await main(['design', 'look'], { cwd: root, ...io() })).toBe(2);
    expect((await touched(root, ['main', 'HEAD'])).code).toBe(2);
  });
});
