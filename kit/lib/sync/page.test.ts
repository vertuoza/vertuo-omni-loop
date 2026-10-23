// The page check's facts (PRD 1990), against an injected `fetch` that plays the Omni page and an
// in-memory token store: no test calls the page.
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Fetch } from '../ask/client.ts';
import type { Tokens } from '../ask/schema.ts';
import { parseConfig } from '../config.ts';
import { readCache, writeCache } from '../constituents/cache.ts';
import { constituentsOf } from '../constituents/read.ts';
import { readSettingsCopy } from '../omni-settings/copy.ts';
import { curatedDefault } from '../omni-settings/curated.ts';
import { realExec } from '../../test/fixture.ts';
import { gatherPage, pageFacts } from './page.ts';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const HOUR = 3_600_000;
const HOST = 'omni.example';
const READ = { state: 'ok', product: { name: 'Vertuoza UX' }, statement: { id: 'statement', text: 'A statement.' }, never: [], latestEventId: '1' };

const configOf = (extra: string) => parseConfig(`kit: 1\nrepo:\n  slug: acme/widgets\n${extra}`);
const ON = configOf(`ask:\n  url: https://${HOST}\ndossier:\n  enabled: true\n`);

const tempRoot = (): string => realpathSync(mkdtempSync(join(tmpdir(), 'omni-sync-page-')));
const io = (root: string, config = ON) => ({ cwd: root, root, config, exec: realExec, now: NOW });

function tokens(entry?: Tokens) {
  const store: Record<string, Tokens> = entry ? { [HOST]: entry } : {};
  return { read: (host: string) => store[host] ?? null, write: (host: string, kept: Tokens) => { store[host] = kept; } };
}
const SIGNED_IN: Tokens = { access_token: 'a', refresh_token: 'r' };

/** A page answering every call with `status` and `body`. */
function page(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetch: Fetch = (url) => {
    calls.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  };
  return { fetch, calls };
}

/** A page that never answers until the call is given up. */
const slow: Fetch = (_url, init) => new Promise((_, reject) => {
  init.signal?.addEventListener('abort', () => {
    reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  });
});

const keep = (root: string, syncedAt: number) => {
  const read = constituentsOf(READ);
  if (read) writeCache(root, { repo: 'acme/widgets', syncedAt: new Date(syncedAt).toISOString(), read });
};

describe('the page check\'s facts', () => {
  it('reads n/a with no page address, or with the dossier switch off', async () => {
    const root = tempRoot();
    await expect(gatherPage(io(root, configOf('')))).resolves.toEqual({ na: 'no Omni page' });
    await expect(gatherPage(io(root, configOf(`ask:\n  url: https://${HOST}\n`)))).resolves.toEqual({ na: 'no Omni page' });
  });

  it('refreshes the copy while signed in, and keeps what the page said', async () => {
    const root = tempRoot();
    const p = page(READ);
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: p.fetch })).resolves.toEqual({ signedIn: true, syncedAt: NOW, answering: true });
    expect(p.calls.toSorted()).toEqual([`https://${HOST}/api/constituents?repo=acme%2Fwidgets`, `https://${HOST}/api/omni-settings/playbook?repo=acme%2Fwidgets`]);
    expect(readCache(root, 'acme/widgets')?.syncedAt).toBe(new Date(NOW).toISOString());
  });

  it('refreshes the Omni-settings copy beside the constituents, and a refused settings read changes no fact', async () => {
    const root = tempRoot();
    const settings = { repository: 'acme/settings', commit: 'abc1234', files: [{ form: 'review', text: curatedDefault().find((p) => p.form === 'review')?.text ?? '' }], reason: null };
    const route = (settingsStatus: number): Fetch => (url) =>
      Promise.resolve(url.includes('/api/omni-settings/') ? new Response(JSON.stringify(settings), { status: settingsStatus }) : new Response(JSON.stringify(READ), { status: 200 }));
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: route(403) })).resolves.toEqual({ signedIn: true, syncedAt: NOW, answering: true });
    expect(readSettingsCopy({ root })).toEqual({ state: 'absent' });
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: route(200) })).resolves.toEqual({ signedIn: true, syncedAt: NOW, answering: true });
    expect(readSettingsCopy({ root })).toMatchObject({ state: 'copied', repository: 'acme/settings', forms: ['review'], readAt: new Date(NOW).toISOString() });
  });

  it('is not signed in with no sign-in, and does not call the page', async () => {
    const root = tempRoot();
    keep(root, NOW - 2 * HOUR);
    const p = page(READ);
    await expect(gatherPage(io(root), { tokens: tokens(), fetch: p.fetch })).resolves.toEqual({ signedIn: false, syncedAt: NOW - 2 * HOUR, answering: false });
    expect(p.calls).toEqual([]);
  });

  it('is not signed in with an expired access token and no refresh token, and signed in with one', async () => {
    const root = tempRoot();
    const expired = { access_token: 'a', expires_at: Math.floor((NOW - HOUR) / 1000) };
    await expect(gatherPage(io(root), { tokens: tokens(expired), fetch: page(READ).fetch })).resolves.toMatchObject({ signedIn: false });
    await expect(gatherPage(io(root), { tokens: tokens({ ...expired, refresh_token: 'r' }), fetch: page(READ).fetch })).resolves.toMatchObject({ signedIn: true, answering: true });
  });

  it('is not signed in when the page refuses the sign-in', async () => {
    const root = tempRoot();
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: page({ error: 'no' }, 401).fetch })).resolves.toMatchObject({ signedIn: false, answering: false });
  });

  it('does not answer when the page is offline, and leaves the copy as old as it was', async () => {
    const root = tempRoot();
    keep(root, NOW - 30 * HOUR);
    const offline: Fetch = () => Promise.reject(new TypeError('fetch failed'));
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: offline })).resolves.toEqual({ signedIn: true, syncedAt: NOW - 30 * HOUR, answering: false });
  });

  it('gives a page slower than its budget up, within that budget', async () => {
    const root = tempRoot();
    const started = Date.now();
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: slow, budgetMs: 50 })).resolves.toEqual({ signedIn: true, syncedAt: null, answering: false });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not answer when the reply is not constituents', async () => {
    const root = tempRoot();
    await expect(gatherPage(io(root), { tokens: tokens(SIGNED_IN), fetch: page({ nonsense: true }).fetch })).resolves.toMatchObject({ answering: false });
  });

  it('is the gatherer the run uses', async () => {
    await expect(pageFacts(io(tempRoot(), configOf('')))).resolves.toEqual({ na: 'no Omni page' });
  });
});
