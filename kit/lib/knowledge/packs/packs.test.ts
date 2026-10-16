// Knowledge packs on this computer (PRD 2011, s12): `omni kb pack get` against a fake server, the
// read-only folder, held mode, the stale-pack rule, and the readers that take a pack before a copy.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AskCallError } from '../../ask/client.ts';
import { makeRepo } from '../../../test/fixture.ts';
import { readCopyFlow } from '../../plan-repo/copy-flow.ts';
import { packGet } from './get.ts';
import type { PackOrder } from './get.ts';
import { ageOf, localPacks, newestPack, packFile, refusalOf } from './store.ts';

const SHA_A = '1'.repeat(40);
const SHA_B = '2'.repeat(40);
const READ_AT = '3'.repeat(40);
const hash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const CONFIG = 'kit: 1\nflow:\n  areas:\n    kernel:\n      paths: [\'^src/kernel/\']\n      hooks:\n        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }\n';

function reply(sha: string, committedAt: string, files: Record<string, string> = { '.omni-loop/config.yml': CONFIG, '.omni-loop/flow/kernel/tests.md': 'Run the kernel tests.\n' }) {
  return {
    repository: 'acme/back',
    sha,
    committedAt,
    madeAt: committedAt,
    files: Object.entries(files).map(([path, content]) => ({ path, sha256: hash(content), content })),
  };
}

const NOW = new Date('2026-10-16T12:00:00Z');
const ok = (): PackOrder => 'ok';

function input(root: string, fetchPack: () => Promise<unknown>, extra: { readAt?: string | null; order?: () => PackOrder } = {}) {
  return { root, repo: 'acme/back', readAt: extra.readAt ?? null, fetchPack, order: extra.order ?? ok, now: () => NOW };
}

describe('packGet', () => {
  it('writes the pack read-only under packs/<name>@<sha>/ and prints that path', async () => {
    const { root } = makeRepo();
    const result = await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-15T00:00:00Z'))));
    const folder = join(root, '.omni-loop/local/packs', `back@${SHA_A}`);
    expect(result).toEqual({ code: 0, out: [folder], err: [] });
    expect(readFileSync(join(folder, '.omni-loop/config.yml'), 'utf8')).toBe(CONFIG);
    expect(statSync(join(folder, '.omni-loop/config.yml')).mode & 0o222).toBe(0);
    expect(statSync(folder).mode & 0o222).toBe(0);
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
    expect(readFileSync(join(folder, 'pack.json'), 'utf8')).toContain(hash(CONFIG));
  });

  it('writes nothing for a file that does not hash to the sha256 sent, or leaves the folder', async () => {
    const { root } = makeRepo();
    const bad = reply(SHA_A, '2026-10-15T00:00:00Z');
    const tampered = bad.files.map((file) => ({ ...file, content: 'tampered' }));
    bad.files.splice(0, bad.files.length, ...tampered);
    const result = await packGet(input(root, () => Promise.resolve(bad)));
    expect(result.code).toBe(1);
    expect(result.err[0]).toContain('does not hash to the sha256 sent');
    expect(existsSync(join(root, '.omni-loop/local/packs'))).toBe(false);
    expect(refusalOf(reply(SHA_A, 'x', { '../escape': 'x' }))).toContain('not a path inside the pack');
  });

  it('holds on the newest pack already fetched, with its sha and age, when the server is unreachable', async () => {
    const { root } = makeRepo();
    await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-14T12:00:00Z'))));
    await packGet(input(root, () => Promise.resolve(reply(SHA_B, '2026-10-15T09:00:00Z'))));
    for (const status of [null, 503]) {
      const held = await packGet(input(root, () => Promise.reject(new AskCallError('down', { status }))));
      expect(held.code).toBe(0);
      expect(held.out).toEqual([join(root, '.omni-loop/local/packs', `back@${SHA_B}`), `held · server unreachable · newest pack fetched: ${SHA_B} · 1d old`]);
    }
  });

  it('stops when the server is unreachable and nothing was fetched', async () => {
    const { root } = makeRepo();
    const result = await packGet(input(root, () => Promise.reject(new AskCallError('down'))));
    expect(result).toEqual({ code: 1, out: [], err: ['no pack of back: the server is unreachable and nothing was fetched yet'] });
  });

  it("never hides another workspace's 404 behind a pack fetched earlier", async () => {
    const { root } = makeRepo();
    await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-14T12:00:00Z'))));
    const result = await packGet(input(root, () => Promise.reject(new AskCallError('not found', { status: 404, reason: 'no pack' }))));
    expect(result).toEqual({ code: 1, out: [], err: ['the server refused the pack of acme/back (404): no pack'] });
  });

  it('refuses a pack older than read_at, printing no folder, and uses one at or past it', async () => {
    const { root } = makeRepo();
    const fetched = () => Promise.resolve(reply(SHA_A, '2026-10-14T12:00:00Z'));
    const stale = await packGet(input(root, fetched, { readAt: READ_AT, order: () => 'behind' }));
    expect(stale).toEqual({ code: 1, out: [], err: [`pack stale: ${SHA_A.slice(0, 7)} < read_at ${READ_AT.slice(0, 7)}`] });
    const fresh = await packGet(input(root, fetched, { readAt: READ_AT, order: () => 'ok' }));
    expect(fresh.code).toBe(0);
    const same = await packGet(input(root, fetched, { readAt: SHA_A, order: () => 'behind' }));
    expect(same.code).toBe(0);
  });

  it('says so when the pack and read_at cannot be compared, and still serves the pack', async () => {
    const { root } = makeRepo();
    const result = await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-14T12:00:00Z')), { readAt: READ_AT, order: () => 'unknown' }));
    expect(result.code).toBe(0);
    expect(result.err[0]).toContain('could not be compared');
  });
});

describe('local packs', () => {
  it('picks the newest by the commit date, whatever the sha', async () => {
    const { root } = makeRepo();
    await packGet(input(root, () => Promise.resolve(reply(SHA_B, '2026-10-10T00:00:00Z'))));
    await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-12T00:00:00Z'))));
    expect(localPacks(root, 'acme/back').map(({ sha }) => sha)).toEqual([SHA_A, SHA_B]);
    expect(newestPack(root, 'back')?.sha).toBe(SHA_A);
    expect(newestPack(root, 'acme/other')).toBeNull();
    const newest = newestPack(root, 'back');
    expect(newest === null ? null : packFile(root, newest, '.omni-loop/flow/kernel/tests.md')).toBe('Run the kernel tests.\n');
  });

  it('writes a commit once: a second fetch leaves the read-only folder as it is', async () => {
    const { root } = makeRepo();
    await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-12T00:00:00Z'))));
    const again = await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-12T00:00:00Z'))));
    expect(again.code).toBe(0);
  });

  it('ages in the largest whole unit', () => {
    expect(ageOf('2026-10-16T11:30:00Z', NOW)).toBe('30m');
    expect(ageOf('2026-10-16T07:00:00Z', NOW)).toBe('5h');
    expect(ageOf('2026-10-13T12:00:00Z', NOW)).toBe('3d');
  });
});

describe('readCopyFlow reads the pack before the copy', () => {
  const plan = { plan: { targets: [{ repo: 'acme/back', role: 'back-end', knowledge: 'imported', readAt: SHA_A }] } };

  it("takes the flow and the hooks of the repository's newest pack", async () => {
    const { root, ctx } = makeRepo({ config: plan });
    await packGet(input(root, () => Promise.resolve(reply(SHA_A, '2026-10-12T00:00:00Z'))));
    const read = readCopyFlow('acme/back', ctx);
    expect(read?.folder).toBe(join('.omni-loop/local/packs', `back@${SHA_A}`));
    expect(read?.config.flow?.areas?.kernel).toBeDefined();
    expect(read?.readHook('.omni-loop/flow/kernel/tests.md')).toBe('Run the kernel tests.\n');
  });

  it('falls back to the copy when no pack was fetched', () => {
    const { ctx, write } = makeRepo({ config: plan });
    write('.omni-loop/knowledge/repos/back/flow/config.yml', CONFIG);
    const read = readCopyFlow('acme/back', ctx);
    expect(read?.folder).toBe(join('.omni-loop/knowledge/repos/back', 'flow'));
  });
});
