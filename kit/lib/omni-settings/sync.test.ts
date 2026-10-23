// The Omni-settings refresh (PRD 2417, s4), against an injected `fetch` that plays the Omni page and
// an in-memory token store: no test calls the page.
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Fetch } from '../ask/client.ts';
import type { Tokens } from '../ask/schema.ts';
import { levelFolder } from '../knowledge-tree/levels.ts';
import { readSettingsCopy, writeSettingsCopy } from './copy.ts';
import { curatedDefault } from './curated.ts';
import { refreshSettingsCopy } from './sync.ts';
import type { SettingsRefreshIo } from './sync.ts';

const NOW = Date.parse('2026-10-20T10:00:00Z');
const HOST = 'omni.example';
const COMMIT = 'abc1234';
const curated = (form: string): string => curatedDefault().find((page) => page.form === form)?.text ?? '';

const tempRoot = (): string => realpathSync(mkdtempSync(join(tmpdir(), 'omni-settings-sync-')));

const store: Record<string, Tokens> = { [HOST]: { access_token: 'a', refresh_token: 'r' } };
const tokens = { read: (host: string) => store[host] ?? null, write: () => {} };

function ioOf(root: string, fetch: Fetch, extra: Partial<SettingsRefreshIo> = {}): SettingsRefreshIo {
  return { root, repo: 'acme/widgets', askUrl: `https://${HOST}`, host: HOST, tokens, fetch, budgetMs: 500, now: NOW, ...extra };
}

function page(body: unknown, status = 200) {
  const calls: string[] = [];
  const fetch: Fetch = (url) => {
    calls.push(url);
    return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  };
  return { fetch, calls };
}

const reply = (forms: string[]) => ({
  repository: 'acme/settings',
  commit: COMMIT,
  files: forms.map((form) => ({ form, text: curated(form) })),
  reason: null,
});

/** A copy of an earlier refresh, written the way the writer does. */
function earlier(root: string): void {
  writeSettingsCopy({ root, files: [{ form: 'review', text: `${curated('review')}\nEarlier copy.\n` }], source: { repository: 'acme/settings', commit: '1111111', readAt: '2026-10-01T00:00:00.000Z' } });
}
const reviewText = (root: string): string => readFileSync(join(root, levelFolder('omni settings'), 'playbook', 'review.md'), 'utf8');

describe('the Omni-settings refresh', () => {
  it('rewrites the copy from the page’s answer and records when it was read', async () => {
    const root = tempRoot();
    earlier(root);
    const p = page(reply(['review', 'definition-of-done']));
    const done = await refreshSettingsCopy(ioOf(root, p.fetch));
    expect(done).toEqual({ state: 'refreshed', written: ['review', 'definition-of-done'] });
    expect(p.calls).toEqual([`https://${HOST}/api/omni-settings/playbook?repo=acme%2Fwidgets`]);
    expect(readSettingsCopy({ root })).toMatchObject({ state: 'copied', repository: 'acme/settings', commit: COMMIT, readAt: new Date(NOW).toISOString(), forms: ['review', 'definition-of-done'] });
    expect(reviewText(root)).not.toContain('Earlier copy.');
    expect(reviewText(root)).toContain('# Review');
  });

  it('leaves the last copy as it was when the page refuses', async () => {
    const root = tempRoot();
    earlier(root);
    for (const status of [401, 403, 500]) {
      const done = await refreshSettingsCopy(ioOf(root, page({ error: 'no' }, status).fetch));
      expect(done.state).toBe('kept');
    }
    expect(reviewText(root)).toContain('Earlier copy.');
    expect(readSettingsCopy({ root })).toMatchObject({ commit: '1111111' });
  });

  it('leaves the last copy as it was offline, and when the page is late', async () => {
    const root = tempRoot();
    earlier(root);
    const offline: Fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await refreshSettingsCopy(ioOf(root, offline))).toEqual({ state: 'kept', why: 'the page did not answer' });
    const slow: Fetch = (_url, init) =>
      new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    expect(await refreshSettingsCopy(ioOf(root, slow, { budgetMs: 20 }))).toEqual({ state: 'kept', why: 'the page did not answer' });
    expect(reviewText(root)).toContain('Earlier copy.');
  });

  it('leaves the copy alone for an answer that does not read, and for a workspace with no settings repository', async () => {
    const root = tempRoot();
    earlier(root);
    expect(await refreshSettingsCopy(ioOf(root, page({ state: 'ok' }).fetch))).toEqual({ state: 'kept', why: 'the page’s answer did not read' });
    const none = { repository: null, commit: null, files: [], reason: 'the workspace names no settings repository' };
    expect(await refreshSettingsCopy(ioOf(root, page(none).fetch))).toEqual({ state: 'kept', why: 'the workspace names no settings repository' });
    expect(reviewText(root)).toContain('Earlier copy.');
  });

  it('writes no copy when there was none and the server is gone', async () => {
    const root = tempRoot();
    await refreshSettingsCopy(ioOf(root, () => Promise.reject(new TypeError('fetch failed'))));
    expect(readSettingsCopy({ root })).toEqual({ state: 'absent' });
  });

  it('empties the copy when the settings repository dropped every page', async () => {
    const root = tempRoot();
    earlier(root);
    const done = await refreshSettingsCopy(ioOf(root, page({ ...reply([]), reason: 'the settings repository holds no playbook file' }).fetch));
    expect(done).toEqual({ state: 'refreshed', written: [] });
    expect(readSettingsCopy({ root })).toMatchObject({ state: 'copied', forms: [] });
  });
});
