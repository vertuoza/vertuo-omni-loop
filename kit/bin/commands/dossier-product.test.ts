// `omni dossier push --product <key> --new`, `omni dossier push <key>-<n>` and `omni dossier get <id> <kind>`
// (PRD 1548 s2), through `main()` on a fixture repository, against a stubbed fetch that follows the dossier
// routes' contract for a product PRD (`apps/galaxy/src/dossier/api.ts`). The sign-in is an in-memory token
// store, the scratch space a folder of the test's own, so nothing real is read or written.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { sha256 } from '../../lib/dossier/folder.ts';
import { LAST_READ_DIR } from '../../lib/dossier/product-prd.ts';
import { makeRepo } from '../../test/fixture.ts';
import type { FetchInit } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const HOST = 'omni.example';
const LINK = `${BASE}/prd/d-12`;
const SPEC = '---\ntitle: Offline photo upload\n---\n\n# Offline photo upload\n';
const PLAN = '# Plan: offline photo upload\n';

const config = ({ enabled = true, slug = 'acme/widgets' }: { enabled?: boolean | undefined; slug?: string | null | undefined } = {}) =>
  `kit: 1\nrepo:\n  slug: ${slug ?? 'null'}\nask:\n  url: ${BASE}\ndossier:\n  enabled: ${enabled}\n`;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}
const signedIn = () => memoryTokens({ [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const down = (): Response => { throw new TypeError('fetch failed'); };

type Sent = { url: string; method: string | undefined; body: unknown };

/** A fetch that answers every call with `reply(url)` and keeps each call, its body parsed. */
function stubFetch(reply: (url: string) => Response) {
  const calls: Sent[] = [];
  const fetch = (url: string, init: FetchInit) => {
    calls.push({ url, method: init.method, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
    return new Promise<Response>((resolve) => { resolve(reply(url)); });
  };
  return { calls, fetch };
}

const scratch = () => mkdtempSync(join(tmpdir(), 'dossier-product-test-'));

async function dossier(args: string[], { reply, enabled, slug, tokens = signedIn() }: {
  reply: (url: string) => Response; enabled?: boolean; slug?: string | null; tokens?: ReturnType<typeof memoryTokens>;
}) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config({ enabled, slug }) } });
  const { calls, fetch } = stubFetch(reply);
  const out: string[] = [];
  const err: string[] = [];
  const base = scratch();
  const code = await main(['dossier', ...args], {
    cwd: repo.root, tokens, env: {}, fetch, scratch: base, now: () => Date.parse('2026-10-11T12:00:00Z'),
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join(''), calls, root: repo.root, base };
}

/** A scratch folder holding the files a brainstorm wrote. */
function files(entries: Record<string, string>): string {
  const dir = scratch();
  for (const [name, content] of Object.entries(entries)) writeFileSync(join(dir, name), content);
  return dir;
}

const PUSHED = { id: 'd-12', prdId: 'mobile-12', url: LINK, added: [{ kind: 'spec', version: 1 }], unchanged: [], product: 'Mobile' };

describe('omni dossier push --product <key> --new: a product PRD is created', () => {
  it('sends the folder\'s files with the spec\'s title, and prints the new id, its link and the versions added', async () => {
    const from = files({ 'spec.md': SPEC });
    const run = await dossier(['push', '--product', 'mobile', '--new', '--from', from], { reply: () => json(200, PUSHED) });
    expect(run).toMatchObject({ code: 0, out: `mobile-12\n${LINK}\nadded: spec v1\n`, err: '' });
    expect(run.calls).toEqual([{
      url: `${BASE}/api/dossiers/push`, method: 'POST',
      body: { productKey: 'mobile', new: true, repo: 'acme/widgets', title: 'Offline photo upload', artifacts: [{ kind: 'spec', content: SPEC }] },
    }]);
  });

  it('takes --title over the spec\'s, creates one with no files, and sends no repository where none is set', async () => {
    const run = await dossier(['push', '--product', 'mobile', '--new', '--title', 'Offline'], { reply: () => json(200, { ...PUSHED, added: [] }), slug: null });
    expect(run.code).toBe(0);
    expect(run.calls[0]?.body).toEqual({ productKey: 'mobile', new: true, title: 'Offline', artifacts: [] });
  });

  it('refuses with no title to give it, a key out of shape, a number with --new, or --new without --product', async () => {
    const usage = [
      ['push', '--product', 'mobile', '--new'],
      ['push', '--product', 'Mobile', '--new', '--title', 'x'],
      ['push', '--product', 'mobile-1', '--new', '--title', 'x'],
      ['push', 'mobile-12', '--product', 'mobile', '--new', '--title', 'x'],
      ['push', '--new', '--title', 'x'],
      ['push', '7', '--from', '/tmp'],
      ['link', 'mobile-12'],
    ];
    for (const args of usage) {
      const run = await dossier(args, { reply: () => json(200, PUSHED) });
      expect([args.join(' '), run.code, run.calls]).toEqual([args.join(' '), 2, []]);
    }
  });

  it('says off, no sign-in, unreachable or the refusal in one line, exit 1', async () => {
    const args = ['push', '--product', 'mobile', '--new', '--title', 'x'];
    expect(await dossier(args, { reply: () => json(200, PUSHED), enabled: false })).toMatchObject({ code: 1, err: 'off\n' });
    expect(await dossier(args, { reply: () => json(200, PUSHED), tokens: memoryTokens() })).toMatchObject({ code: 1, err: 'no sign-in (omni signin)\n' });
    expect(await dossier(args, { reply: down })).toMatchObject({ code: 1, err: 'unreachable\n' });
    expect(await dossier(args, { reply: () => json(404, { error: 'No product keyed mobile in your workspaces.' }) })).toMatchObject({ code: 1, err: 'refused (404)\n' });
    expect(await dossier(args, { reply: () => json(200, { id: 'd-12', url: LINK }) })).toMatchObject({ code: 1, err: 'refused (no product PRD in the reply)\n' });
  });
});

describe('omni dossier push <key>-<n>: a product PRD\'s edited files, as new versions', () => {
  it('pushes to the PRD by its number, titled after the spec there', async () => {
    const from = files({ 'spec.md': SPEC, 'plan.md': PLAN });
    const run = await dossier(['push', 'mobile-12', '--from', from], { reply: () => json(200, { ...PUSHED, added: [{ kind: 'plan', version: 2 }], unchanged: ['spec'] }) });
    expect(run).toMatchObject({ code: 0, out: `mobile-12\n${LINK}\nadded: plan v2 · unchanged: spec\n` });
    expect(run.calls.map((c) => c.body)).toEqual([{
      productKey: 'mobile', prd: 12, repo: 'acme/widgets', title: 'Offline photo upload', artifacts: [{ kind: 'spec', content: SPEC }, { kind: 'plan', content: PLAN }],
    }]);
  });

  it('with no spec there, keeps the title the PRD has, read from its page', async () => {
    const from = files({ 'plan.md': PLAN });
    const run = await dossier(['push', 'mobile-12', '--from', from], {
      reply: (url) => (url.includes('/push') ? json(200, PUSHED) : json(200, { id: 'd-12', url: LINK, prdId: 'mobile-12', title: 'Offline photo upload', product: 'Mobile', approval: null })),
    });
    expect(run.code).toBe(0);
    expect(run.calls.map((c) => c.url)).toEqual([`${BASE}/api/dossiers?product=mobile&prd=12&repo=acme%2Fwidgets`, `${BASE}/api/dossiers/push`]);
    expect(run.calls[1]?.body).toMatchObject({ productKey: 'mobile', prd: 12, title: 'Offline photo upload' });
  });

  it('names a file too large to send, and exits 1', async () => {
    const from = files({ 'spec.md': SPEC, 'before-after.html': 'x'.repeat(512 * 1024 + 1) });
    const run = await dossier(['push', 'mobile-12', '--from', from], { reply: () => json(200, PUSHED) });
    expect(run).toMatchObject({ code: 1, err: `too large: ${join(from, 'before-after.html')}\n` });
  });
});

describe('omni dossier get <id> <kind>: the latest version, in a scratch file', () => {
  const LATEST = { id: 'd-12', prdId: 'mobile-12', url: LINK, kind: 'plan', version: 3, sha256: sha256(PLAN), content: PLAN, createdAt: '2026-10-11T09:00:00.000Z' };

  it('writes it under its file name outside the repository, prints the path and its sha256, and keeps a last-read copy', async () => {
    const run = await dossier(['get', 'mobile-12', 'plan'], { reply: () => json(200, LATEST) });
    expect(run.code).toBe(0);
    const [path = '', hash] = run.out.trimEnd().split('\n');
    expect(path.startsWith(join(run.base, 'omni-mobile-12-'))).toBe(true);
    expect(path.endsWith('plan.md')).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(PLAN);
    expect(hash).toBe(`sha256 ${sha256(PLAN)}`);
    expect(run.calls).toEqual([{ url: `${BASE}/api/dossiers/get?product=mobile&prd=12&kind=plan&repo=acme%2Fwidgets`, method: 'GET', body: undefined }]);
    expect(existsSync(join(run.root, LAST_READ_DIR, 'mobile-12', 'plan.json'))).toBe(true);
  });

  it('refuses a version whose content does not hash as the server says, and writes nothing', async () => {
    const run = await dossier(['get', 'mobile-12', 'plan'], { reply: () => json(200, { ...LATEST, sha256: 'f'.repeat(64) }) });
    expect(run).toMatchObject({ code: 1, out: '', err: 'refused (the plan does not hash as the server says)\n' });
  });

  it('holds while the server is down, never answering from the last-read copy; none when there is no such version', async () => {
    expect(await dossier(['get', 'mobile-12', 'plan'], { reply: down })).toMatchObject({ code: 1, out: '', err: 'held · server unreachable · held, not failed\n' });
    expect(await dossier(['get', 'mobile-12', 'plan'], { reply: () => json(404, { error: 'PRD mobile-12 has no plan yet.' }) })).toMatchObject({ code: 1, err: 'none\n' });
  });

  it('refuses a PRD of a repository, a kind a PRD has not, or a missing kind', async () => {
    for (const args of [['get', '12', 'plan'], ['get', 'mobile-12', 'bug-record'], ['get', 'mobile-12'], ['get', 'Mobile-12', 'plan']]) {
      expect((await dossier(args, { reply: () => json(200, LATEST) })).code).toBe(2);
    }
  });
});
