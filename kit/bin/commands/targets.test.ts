// `omni targets` (PRD 522, s1), through `main()` on a fixture repository with `gh` faked: the table in
// config order, `--json`, the exit code, and a repository with no plan section. It never calls GitHub.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';
import type { ExecFileSyncOptions } from 'node:child_process';
import { realExec } from '../../test/fixture.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const BUNDLE = 'var define_OMNI_BUNDLE_default = { home: "acme/kit", version: "0.0.40" };\n';
const FILLED = '---\nform: testing\nstate: filled\n---\n\n# Testing\n';
const WITH_LOOP = {
  '.omni-loop/config.yml': 'kit: 1\n',
  '.omni-loop/bin/omni.mjs': BUNDLE,
  '.omni-loop/knowledge/playbook/testing.md': FILLED,
};

const PLAN = `kit: 1
repo:
  slug: acme/plan
plan:
  guide: docs/git-repositories/README.md
  targets:
    - repo: acme/front
      role: front-end
      knowledge: own
    - repo: acme/legacy
      role: legacy
      knowledge: none
`;
const WITH_TYPO = `${PLAN}    - repo: acme/typo
      role: front-end
      knowledge: own
`;

/** A fake `execFileSync` answering `gh api` for the repositories of `world` (see targets.test.mjs). */
/** The repositories `gh` can read: each one's files, path to text. */
type World = Record<string, Record<string, string>>;

function fakeGh(world: World) {
  const calls: string[] = [];
  const exec = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
    if (file === 'git') return realExec(file, args, options);
    if (file !== 'gh') throw new Error(`unexpected ${file}`);
    calls.push(args.join(' '));
    const endpoint = String(args[args.length - 1]);
    const [, owner, name, kind, ...rest] = String(endpoint.split('?')[0]).split('/');
    const repo = world[`${owner}/${name}`];
    if (!repo) throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
    if (kind === undefined) return JSON.stringify({ default_branch: 'main' });
    const path = rest.map(decodeURIComponent).join('/');
    if (Object.hasOwn(repo, path)) return String(repo[path]);
    const under = Object.keys(repo).filter((f) => f.startsWith(`${path}/`) && !f.slice(path.length + 1).includes('/'));
    if (under.length) return JSON.stringify(under.map((f) => ({ type: 'file', name: f.split('/').pop(), path: f })));
    throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
  };
  return { exec, calls };
}

async function targets(args: string[], { config, world = {} }: { config: string; world?: World }) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const { exec, calls } = fakeGh(world);
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['targets', ...args], { cwd: root, exec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), calls };
}

const ALL_OK = { 'acme/front': WITH_LOOP, 'acme/legacy': { 'README.md': 'hi' } };

describe('omni targets', () => {
  it('prints one row per target in config order, and exits 0 when every row is ok', async () => {
    const { code, out, err } = await targets([], { config: PLAN, world: ALL_OK });
    expect(err).toBe('');
    expect(out).toBe([
      'repo         role       knowledge  loop           state',
      'acme/front   front-end  own        v0.0.40        ok',
      'acme/legacy  legacy     none       not installed  ok',
      '',
    ].join('\n'));
    expect(code).toBe(0);
  });

  it('keeps a row gh cannot read, and exits 1 when a row is not ok', async () => {
    const { code, out } = await targets([], { config: WITH_TYPO, world: ALL_OK });
    expect(out.split('\n')[3]).toMatch(/^acme\/typo\s+front-end\s+own\s+—\s+unreachable \(gh: Not Found \(HTTP 404\)\)$/);
    expect(code).toBe(1);
  });

  it('prints the same rows as JSON with --json', async () => {
    const { code, out } = await targets(['--json'], { config: WITH_TYPO, world: ALL_OK });
    expect(JSON.parse(out)).toEqual([
      { repo: 'acme/front', role: 'front-end', knowledge: 'own', loop: 'v0.0.40', state: 'ok', detail: null },
      { repo: 'acme/legacy', role: 'legacy', knowledge: 'none', loop: 'not installed', state: 'ok', detail: null },
      { repo: 'acme/typo', role: 'front-end', knowledge: 'own', loop: '—', state: 'unreachable', detail: 'gh: Not Found (HTTP 404)' },
    ]);
    expect(code).toBe(1);
  });

  it('reads an imported target stale when its head changed an evidence file of its copy', async () => {
    const config = `${PLAN}    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: ${SHA}
`;
    const { root } = makeRepo({
      git: true,
      files: {
        '.omni-loop/config.yml': config,
        '.omni-loop/knowledge/repos/back/playbook/testing.md':
          '---\nform: testing\nform-version: 1\nstate: filled\npoints-to: null\nevidence:\n  - composer.json@50fa1bd\ninvaded: null\n---\n\n# Testing\n',
      },
    });
    const { exec } = fakeGh(ALL_OK);
    const faked = (file: string, args: readonly string[], options?: ExecFileSyncOptions): string => {
      if (file === 'git') return realExec(file, args, options);
      const endpoint = String(args[args.length - 1]);
      if (endpoint === 'repos/acme/back') return JSON.stringify({ default_branch: 'main' });
      if (endpoint === `repos/acme/back/compare/${SHA}...main`) return JSON.stringify({ ahead_by: 3, files: [{ filename: 'composer.json' }] });
      if (endpoint.startsWith('repos/acme/back/')) throw Object.assign(new Error('gh failed'), { stderr: 'gh: Not Found (HTTP 404)\n' });
      return exec(file, args, options);
    };
    const out: string[] = [];
    const code = await main(['targets', '--json'], { cwd: root, exec: faked, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
    expect(JSON.parse(out.join(''))[2]).toEqual({
      repo: 'acme/back', role: 'back-end', knowledge: 'imported', loop: 'not installed', state: 'stale', detail: '3 commits, 1 evidence file changed',
    });
    expect(code).toBe(1);
  });

  it('says not a plan repository, exit 1, when the config has no plan section, and asks GitHub nothing', async () => {
    for (const args of [[], ['--json']]) {
      const { code, out, calls } = await targets(args, { config: 'kit: 1\nrepo:\n  slug: acme/widgets\n' });
      expect(out).toBe('not a plan repository\n');
      expect(code).toBe(1);
      expect(calls).toEqual([]);
    }
  });

  it('has its entry in omni help targets', async () => {
    const out: string[] = [];
    const code = await main(['help', 'targets'], { cwd: makeRepo({ git: true, files: { '.omni-loop/config.yml': PLAN } }).root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    expect(out.join('')).toMatch(/omni targets \[--json\]/);
    expect(out.join('')).toMatch(/not a plan repository/);
  });

  it('refuses an argument or a flag it does not take, exit 2', async () => {
    expect((await targets(['acme/front'], { config: PLAN, world: ALL_OK })).code).toBe(2);
    expect((await targets(['--fetch'], { config: PLAN, world: ALL_OK })).code).toBe(2);
  });
});
