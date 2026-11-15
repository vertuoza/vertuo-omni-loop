// PRD #2251, slice s5: `omni now --json` carries the runner rows — the slots free while a runner is
// online for the repository (cached in the local folder, null when the read fails, no key when nobody
// is signed in) and the followed job's last milestone.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenStore } from '../../lib/ask/client.ts';
import { parsePr } from '../../lib/ids.ts';
import { aChange, fakeLoopReads } from '../../lib/loop-reads/fake.ts';
import { LoopReadError } from '../../lib/loop-reads/port.ts';
import type { LoopReads } from '../../lib/loop-reads/port.ts';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { now } from './now.ts';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
const tokens = (signedIn: boolean): TokenStore => ({ read: () => (signedIn ? { access_token: 'a', refresh_token: 'r', expires_at: null } : null), write: () => undefined, clear: () => undefined }) as unknown as TokenStore;
const runners = [{ id: 'r1', name: 'one', fleet: null, state: 'online', used: 1, slots: 3, repos: ['acme/widgets'] }];

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function ask({ signedIn = true, body = { runners }, fail = false }: { signedIn?: boolean; body?: unknown; fail?: boolean } = {}) {
  const repo = makeRepo({ files: { '.omni-loop/config.yml': CONFIG }, git: true });
  roots.push(repo.root);
  const fetch = vi.fn(() => (fail ? Promise.reject(new Error('down')) : Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })))) as unknown as typeof globalThis.fetch;
  let out = '';
  const io = { cwd: repo.root, stdout: { write: (chunk: string) => (out += chunk) }, stderr: { write: () => undefined }, exec: realExec, env: {}, vars: {}, stdin: '', now: () => NOW, tokens: tokens(signedIn), fetch };
  const run = async (args: string[] = ['--json']) => {
    out = '';
    await now.run(args, io as never);
    return out;
  };
  return { repo, fetch, run, parsed: async () => JSON.parse(await run()) as Record<string, unknown> };
}

describe('omni now --json, the runner rows', () => {
  it('carries the slots free of the runners online for this repository', async () => {
    const { parsed } = ask();
    expect(await parsed()).toMatchObject({ runners: { free: 2, slots: 3 } });
  });

  it('reads the page once in 30 seconds', async () => {
    const { run, fetch } = ask();
    await run();
    await run();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('carries runners null when the read fails, and no key when nobody is signed in', async () => {
    expect(await ask({ fail: true }).parsed()).toMatchObject({ runners: null });
    const out = ask({ signedIn: false });
    expect(await out.parsed()).not.toHaveProperty('runners');
    expect(out.fetch).not.toHaveBeenCalled();
  });

  it('carries the followed job\'s last milestone while a follow keeps one', async () => {
    const { repo, parsed } = ask({ signedIn: false });
    mkdirSync(join(repo.root, '.omni-loop/local/runner-follow'), { recursive: true });
    writeFileSync(join(repo.root, '.omni-loop/local/runner-follow/2223.json'), JSON.stringify({ prd: 2223, runner: 'box-1', line: '1/2 slices merged', at: '2026-10-20T12:00:00.000Z' }));
    expect(await parsed()).toMatchObject({ runner: { line: 'PRD 2223 on box-1 · 1/2 slices merged' } });
  });

  it('asks the page for nothing without --json', async () => {
    const { run, fetch } = ask();
    expect(await run([])).not.toContain('runners');
    expect(fetch).not.toHaveBeenCalled();
  });
});

// PRD 2906, slice s2: `omni now --status --fetch` reads the work's pull request through `LoopReads`, with a
// limit, keeps it beside the links, and shows the last copy with its age when GitHub does not answer.
describe('omni now --status --fetch', () => {
  const FIX_FILES = { '.omni-loop/config.yml': CONFIG, '.omni-loop/delivery/bugs/1180-login/bug.md': '# login\n' };

  function onFix() {
    const repo = makeRepo({ files: FIX_FILES, git: true });
    roots.push(repo.root);
    execFileSync('git', ['checkout', '-q', '-b', 'fix/login'], { cwd: repo.root });
    return repo;
  }

  async function status(root: string, reads: LoopReads, fetchMs = 5000) {
    let out = '';
    const io = { cwd: root, stdout: { write: (chunk: string) => (out += chunk) }, stderr: { write: () => undefined }, exec: realExec, env: {}, vars: {}, stdin: '', now: () => NOW, tokens: tokens(false), reads, fetchMs };
    const code = await now.run(['--status', '--fetch'], io as never);
    return { code, out };
  }

  const answering = (checks: { name: string; state: 'pending' | 'success' | 'failure' }[]) =>
    fakeLoopReads({
      changes: { 'acme/widgets': [aChange({ number: parsePr(2892), head: 'fix/login', state: 'draft' })] },
      details: { 'acme/widgets#2892': { files: ['kit/lib/login.ts'], review: { checks, mergeable: true, threads: [] } } },
    });

  it('reads the pull request, shows the block as just checked, and keeps the pull request beside the links', async () => {
    const { root } = onFix();
    const { code, out } = await status(root, answering([{ name: 'lint-and-test', state: 'failure' }]));
    expect(code).toBe(0);
    expect(out).toContain('🔴 Stuck');
    expect(out).toContain('lint-and-test · failed');
    expect(out).toContain('https://example.test/changes/2892');
    expect(out).toContain('Checked just now.');
    const kept = JSON.parse(readFileSync(join(root, '.omni-loop/local/now/pr-bug-1180.json'), 'utf8')) as { number: number; state: string };
    expect(kept).toMatchObject({ number: 2892, state: 'draft' });
  });

  it('shows the last copy and how old it is when the reads do not answer', async () => {
    const { root } = onFix();
    await status(root, answering([{ name: 'test', state: 'success' }]));
    const failing = fakeLoopReads({ everything: new LoopReadError('no answer', 'everything') });
    const { out } = await status(root, failing);
    expect(out).toContain('Checked 1 min ago (GitHub did not answer).');
    expect(out).toContain('https://example.test/changes/2892');
  });

  it('stops waiting after the limit, with no copy kept yet', async () => {
    const { root } = onFix();
    const hanging = { ...fakeLoopReads(), changes: () => new Promise<never>(() => undefined) } as LoopReads;
    const { code, out } = await status(root, hanging, 20);
    expect(code).toBe(0);
    expect(out).toContain('Not checked yet (GitHub did not answer).');
  });
});
