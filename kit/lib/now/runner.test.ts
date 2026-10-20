// PRD #2251, slice s5: the runner rows `omni now` adds: the slots free while a runner is online for
// this repository (read from the page, cached 30 seconds, hidden when the read fails) and the last
// milestone `omni runner follow` keeps in `.omni-loop/local/runner-follow/<n>.json`.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenStore } from '../ask/client.ts';
import type { KitRunner } from '../runner/api.ts';
import { withRunners } from './now.ts';
import { readFollow, readRunners, RUNNERS_TTL_MS, slotsOf } from './runner.ts';

const REPO = 'acme/app';
const ASK = 'https://omni.example.test';
const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const runner = (more: Partial<KitRunner>): KitRunner => ({ id: 'r1', name: 'one', fleet: null, state: 'online', used: 0, slots: 2, repos: [REPO], ...more });
const signedIn: TokenStore = { read: () => ({ access_token: 'a', refresh_token: 'r', expires_at: null }), write: () => undefined, clear: () => undefined } as unknown as TokenStore;
const signedOut: TokenStore = { read: () => null, write: () => undefined, clear: () => undefined } as unknown as TokenStore;
const reply = (runners: KitRunner[]): typeof fetch => vi.fn(() => Promise.resolve(new Response(JSON.stringify({ runners }), { status: 200, headers: { 'content-type': 'application/json' } }))) as unknown as typeof fetch;

let root = '';
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'omni-now-runner-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('the slots free', () => {
  it('sums the slots of the runners online or busy for the repository, and none for the others', () => {
    const runners = [runner({ used: 1 }), runner({ id: 'r2', state: 'busy', used: 2, slots: 3 }), runner({ id: 'r3', state: 'offline' }), runner({ id: 'r4', repos: ['acme/other'] })];
    expect(slotsOf(runners, REPO)).toEqual({ free: 2, slots: 5 });
  });

  it('is null while no runner is online for the repository', () => {
    expect(slotsOf([runner({ state: 'offline' }), runner({ repos: ['acme/other'] })], REPO)).toBeNull();
    expect(slotsOf([], REPO)).toBeNull();
  });
});

describe('the read of the runners', () => {
  const at = (more: Partial<Parameters<typeof readRunners>[0]> = {}): Parameters<typeof readRunners>[0] => ({ root, repo: REPO, askUrl: ASK, tokens: signedIn, fetch: reply([runner({ used: 1 })]), now: NOW, ...more });

  it('reads the page, then answers from the cache for 30 seconds', async () => {
    const fetch = reply([runner({ used: 1 })]);
    expect(await readRunners(at({ fetch }))).toEqual({ free: 1, slots: 2 });
    expect(await readRunners(at({ fetch, now: NOW + RUNNERS_TTL_MS - 1 }))).toEqual({ free: 1, slots: 2 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await readRunners(at({ fetch, now: NOW + RUNNERS_TTL_MS }))).toEqual({ free: 1, slots: 2 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('is null when the read fails, and keeps that for 30 seconds too', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('down'))) as unknown as typeof globalThis.fetch;
    expect(await readRunners(at({ fetch }))).toBeNull();
    expect(await readRunners(at({ fetch, now: NOW + 1000 }))).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(join(root, '.omni-loop/local/runners-cache.json'), 'utf8'))).toEqual({ at: NOW, runners: null });
  });

  it('asks nothing when nobody is signed in', async () => {
    const fetch = reply([]);
    expect(await readRunners(at({ tokens: signedOut, fetch }))).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('the followed job', () => {
  const keep = (prd: number, file: unknown): void => {
    mkdirSync(join(root, '.omni-loop/local/runner-follow'), { recursive: true });
    writeFileSync(join(root, '.omni-loop/local/runner-follow', `${String(prd)}.json`), typeof file === 'string' ? file : JSON.stringify(file));
  };

  it('is the last milestone, with the runner that claimed the job', () => {
    keep(2223, { prd: 2223, runner: 'vertuo-agents', line: '1/2 slices merged', at: '2026-10-20T12:00:00.000Z' });
    expect(readFollow(root)).toEqual({ line: 'PRD 2223 on vertuo-agents · 1/2 slices merged' });
  });

  it('leaves the runner out while none claimed the job, and takes the file written last', () => {
    keep(1, { prd: 1, runner: 'old', line: 'queued', at: '2026-10-20T11:00:00.000Z' });
    keep(2, { prd: 2, runner: null, line: 'queued', at: '2026-10-20T12:00:00.000Z' });
    expect(readFollow(root)).toEqual({ line: 'PRD 2 · queued' });
  });

  it('is null with no follow, or a file of another shape', () => {
    expect(readFollow(root)).toBeNull();
    keep(3, 'not json');
    keep(4, { prd: 4 });
    expect(readFollow(root)).toBeNull();
  });
});

describe('the answer', () => {
  const answer = { headline: null, work: null, doing: null };

  it('carries runners and runner only when there are, and runners null when the read failed', () => {
    expect(withRunners(answer, undefined, null)).toEqual(answer);
    expect(withRunners(answer, null, null)).toEqual({ ...answer, runners: null });
    expect(withRunners(answer, { free: 3, slots: 8 }, { line: 'x' })).toEqual({ ...answer, runners: { free: 3, slots: 8 }, runner: { line: 'x' } });
  });
});
