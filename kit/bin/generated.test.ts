// `omni generated <range> [--json]` (PRD 1138): each generated output, stale or fresh for a range.
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
const GENERATED =
  'generated:\n  - path: kit/dist/\n    from: [kit/lib/, kit/bin/]\n    build: pnpm kit:build\n' +
  '  - path: app/api/\n    from: [app/src/, kit/lib/]\n    build: node app/build.ts\n';
const FILES = { 'kit/lib/a.ts': 'a', 'kit/dist/omni.mjs': 'x', 'app/src/b.ts': 'b', 'docs/c.md': 'c' };

/** A fixture repository with the config given, then one commit changing `changed`. */
function repoChanging(config: string, changed: readonly string[]) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config, ...FILES } });
  for (const path of changed) repo.write(path, `changed ${path}`);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo.root, stdio: 'ignore' });
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'change');
  return repo;
}

async function generated(root: string, args: string[]) {
  const s = io();
  const code = await main(['generated', ...args], { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni generated', () => {
  it('lists kit/dist/ stale for a range that changed kit/lib/, each output with its build', async () => {
    const { root } = repoChanging(HEAD + GENERATED, ['kit/lib/a.ts']);
    const { code, out } = await generated(root, ['HEAD~1..HEAD']);
    expect(code).toBe(0);
    expect(out).toBe('kit/dist/: stale — pnpm kit:build\napp/api/: stale — node app/build.ts\n');
  });

  it('lists every output fresh for a range that changed only docs, or only an output', async () => {
    const { root } = repoChanging(HEAD + GENERATED, ['docs/c.md', 'kit/dist/omni.mjs']);
    const { code, out } = await generated(root, ['HEAD~1..HEAD']);
    expect(code).toBe(0);
    expect(out).toBe('kit/dist/: fresh — pnpm kit:build\napp/api/: fresh — node app/build.ts\n');
  });

  it('prints the same as one JSON document with --json', async () => {
    const { root } = repoChanging(HEAD + GENERATED, ['app/src/b.ts']);
    const { code, out } = await generated(root, ['HEAD~1..HEAD', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual([
      { path: 'kit/dist/', from: ['kit/lib/', 'kit/bin/'], build: 'pnpm kit:build', stale: false },
      { path: 'app/api/', from: ['app/src/', 'kit/lib/'], build: 'node app/build.ts', stale: true },
    ]);
  });

  it('prints no generated files and exits 0 without the section; --json prints an empty list', async () => {
    const { root } = repoChanging(HEAD, ['kit/lib/a.ts']);
    expect(await generated(root, ['HEAD~1..HEAD'])).toMatchObject({ code: 0, out: 'no generated files\n' });
    expect(await generated(root, ['HEAD~1..HEAD', '--json'])).toMatchObject({ code: 0, out: '[]\n' });
  });

  it('stops with exit 2 on no range, two ranges, or a range git cannot read', async () => {
    const { root } = repoChanging(HEAD + GENERATED, ['kit/lib/a.ts']);
    const none = await generated(root, []);
    expect(none.code).toBe(2);
    expect(none.err).toMatch(/usage: omni generated <range> \[--json\]/);
    expect((await generated(root, ['HEAD~1..HEAD', 'HEAD'])).code).toBe(2);
    const bad = await generated(root, ['nope..HEAD']);
    expect(bad.code).toBe(2);
    expect(bad.err).toMatch(/omni generated: cannot read nope\.\.HEAD/);
  });
});
