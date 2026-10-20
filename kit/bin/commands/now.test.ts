// PRD #2251, slice s5: `omni now --json` carries the runner rows — the slots free while a runner is
// online for the repository (cached in the local folder, null when the read fails, no key when nobody
// is signed in) and the followed job's last milestone.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TokenStore } from '../../lib/ask/client.ts';
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

async function ask({ signedIn = true, body = { runners }, fail = false }: { signedIn?: boolean; body?: unknown; fail?: boolean } = {}) {
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
    const { parsed } = await ask();
    expect(await parsed()).toMatchObject({ runners: { free: 2, slots: 3 } });
  });

  it('reads the page once in 30 seconds', async () => {
    const { run, fetch } = await ask();
    await run();
    await run();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('carries runners null when the read fails, and no key when nobody is signed in', async () => {
    expect(await (await ask({ fail: true })).parsed()).toMatchObject({ runners: null });
    const out = await ask({ signedIn: false });
    expect(await out.parsed()).not.toHaveProperty('runners');
    expect(out.fetch).not.toHaveBeenCalled();
  });

  it('carries the followed job\'s last milestone while a follow keeps one', async () => {
    const { repo, parsed } = await ask({ signedIn: false });
    mkdirSync(join(repo.root, '.omni-loop/local/runner-follow'), { recursive: true });
    writeFileSync(join(repo.root, '.omni-loop/local/runner-follow/2223.json'), JSON.stringify({ prd: 2223, runner: 'vertuo-agents', line: '1/2 slices merged', at: '2026-10-20T12:00:00.000Z' }));
    expect(await parsed()).toMatchObject({ runner: { line: 'PRD 2223 on vertuo-agents · 1/2 slices merged' } });
  });

  it('asks the page for nothing without --json', async () => {
    const { run, fetch } = await ask();
    expect(await run([])).not.toContain('runners');
    expect(fetch).not.toHaveBeenCalled();
  });
});
