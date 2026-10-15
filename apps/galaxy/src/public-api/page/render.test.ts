import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ApiKey } from '../keys/api-keys.contract';
import { ApiKeysPage } from './ApiKeysPage';
import { ALL_REPOSITORIES, API_REFERENCE, ApiKeysView, NEW_KEY, NO_KEY_YET, NOT_AGAIN, NOT_WORKING, ONLY_OWNERS, REVOKE, REVOKE_FOR_GOOD } from './ApiKeysView';
import { demoApiKeysView } from './demo';
import { apiKeysReducer, initialApiKeysState, type ApiKeysPageView, type ApiKeysState } from './model';

// Settings › API keys drawn (PRD 2022 s1; the `api-keys` screen of the design library): an owner's view,
// a member's, no key yet, the key just made, and every situation under the Settings tabs.

const NOW = new Date('2026-10-15T12:00:00Z');
const SECRET = `oma_Xk3vQ2nB7tY0pLm4sWc8dR1hJ6uZ${'A'.repeat(11)}9fQe`;
const key = (id: string, name: string, more: Partial<ApiKey> = {}): ApiKey => ({
  id, name, lastFour: '9fQe', repos: [], createdAt: '2026-10-15T09:00:00Z', lastUsedAt: null, revokedAt: null,
  maker: { id: 'u-1', login: 'pierrederval', name: null }, working: true, ...more,
});
const QA = key('k-1', 'QA dashboard', { repos: ['vertuoza/backend-php'], lastUsedAt: '2026-10-15T11:58:00Z' });
const DIGEST = key('k-2', 'Weekly digest', { lastFour: 'A1c0', maker: { id: 'u-2', login: 'irisa', name: null } });

const view = (state: ApiKeysState, owner: boolean, tracked: string[] = []) =>
  renderToStaticMarkup(createElement(ApiKeysView, { state, owner, tracked, now: NOW }));
const rows = (html: string) => [...html.matchAll(/<tr data-key="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => ({ id: m[1], html: m[2] ?? '' }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, '\'').replace(/\s+/g, ' ');
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

describe('an owner’s view', () => {
  const html = view(initialApiKeysState([QA, DIGEST]), true);

  it('has New key beside the title, and the API reference link', () => {
    expect(html).toMatch(/<h1 id="api-keys-title">API keys<\/h1>/);
    expect(buttons(html)).toContain(NEW_KEY);
    expect(html).toContain(`<a href="/docs/api">${API_REFERENCE}</a>`);
  });

  it('lists each key: its name, who made it and when, oma_… and its last four, its repositories, when last used, and Revoke', () => {
    const [qa, digest] = rows(html);
    expect(qa?.id).toBe('k-1');
    expect(text(qa?.html ?? '')).toContain('QA dashboard @pierrederval · 15 Oct 2026 oma_…9fQe backend-php Last used 2 min ago Revoke');
    expect(qa?.html).toContain('title="vertuoza/backend-php"');
    expect(text(digest?.html ?? '')).toContain(`Weekly digest @irisa · 15 Oct 2026 oma_…A1c0 ${ALL_REPOSITORIES} Last used Never Revoke`);
    expect(html).toContain(`aria-label="${REVOKE} QA dashboard"`);
    expect(html).not.toContain(ONLY_OWNERS);
  });

  it('asks Revoke a second time before it revokes', () => {
    const asked = view(apiKeysReducer(initialApiKeysState([QA, DIGEST]), { type: 'confirm', id: 'k-1' }), true);
    expect(buttons(rows(asked)[0]?.html ?? '')).toEqual([REVOKE_FOR_GOOD, 'Keep']);
    expect(buttons(rows(asked)[1]?.html ?? '')).toEqual([REVOKE]);
  });

  it('opens the New key form with a name, All repositories, or a pick among the tracked ones', () => {
    const open = apiKeysReducer(initialApiKeysState([]), { type: 'open' });
    const form = view(open, true, ['vertuoza/backend-php', 'vertuoza/web']);
    expect(form).toContain('<form class="api-keys-form" aria-label="New key">');
    expect(form).toMatch(/<input type="text" maxLength="40"[^>]* name="name"/);
    expect(text(form)).toContain(`Repositories ${ALL_REPOSITORIES} Only these:`);
    expect(buttons(form)).not.toContain(NEW_KEY);
    expect(form).not.toContain('vertuoza/web');
    const picking = view(apiKeysReducer(open, { type: 'all', all: false }), true, ['vertuoza/backend-php', 'vertuoza/web']);
    expect(picking).toContain('value="vertuoza/backend-php"');
    expect(picking).toContain('value="vertuoza/web"');
  });

  it('marks a key whose maker left as no longer working', () => {
    expect(view(initialApiKeysState([key('k-3', 'Old', { working: false })]), true)).toContain(NOT_WORKING);
  });
});

describe('a member’s view', () => {
  const html = view(initialApiKeysState([QA, DIGEST]), false);

  it('lists the keys without New key or Revoke, and says only owners make or revoke keys', () => {
    expect(rows(html)).toHaveLength(2);
    expect(buttons(html)).toEqual([]);
    expect(html).not.toContain('<form');
    expect(text(html)).toContain(ONLY_OWNERS);
    expect(html).toContain(API_REFERENCE);
  });
});

describe('no key yet', () => {
  it('says so, and an owner sees New key', () => {
    const owner = view(initialApiKeysState([]), true);
    expect(text(owner)).toContain(NO_KEY_YET);
    expect(owner).not.toContain('<table');
    expect(buttons(owner)).toEqual([NEW_KEY]);
    expect(buttons(view(initialApiKeysState([]), false))).toEqual([]);
  });
});

describe('the key just made', () => {
  const made = apiKeysReducer(initialApiKeysState([DIGEST]), { type: 'made', key: QA, secret: SECRET, origin: 'https://www.omni-loop.xyz' });
  const html = view(made, true);

  it('shows its whole secret once with Copy, that it will not be seen again, and a curl', () => {
    expect(html).toContain(`<code data-secret="true">${SECRET}</code>`);
    expect(buttons(html)).toContain('Copy');
    expect(text(html)).toContain(NOT_AGAIN);
    expect(html).toContain(`curl https://www.omni-loop.xyz/api/v1/prds \\\n  -H &quot;Authorization: Bearer ${SECRET}&quot;`);
    expect(rows(html).map((r) => r.id)).toEqual(['k-1', 'k-2']);
  });

  it('leaves the secret out of the table, and out of a fresh page', () => {
    expect(rows(html).some((r) => r.html.includes(SECRET))).toBe(false);
    expect(view(initialApiKeysState(made.keys), true)).not.toContain(SECRET);
  });

  it('makes Copy the one primary action, New key quiet beside it', () => {
    const primaries = [...html.matchAll(/<button type="button" class="ask-button"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(primaries).toEqual(['Copy']);
    expect(html).toContain(`class="ask-button quiet">${NEW_KEY}<`);
  });

  it('says Copied once copied', () => {
    expect(buttons(view(apiKeysReducer(made, { type: 'copied' }), true))).toContain('Copied');
  });
});

describe('the page in each situation', () => {
  const page = (v: ApiKeysPageView) => renderToStaticMarkup(createElement(ApiKeysPage, { view: v, now: NOW.toISOString() }));
  const situations: ApiKeysPageView[] = [
    { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' },
    { kind: 'keys', source: { kind: 'database', workspace: 'ws-1' }, owner: false, keys: [QA], tracked: [] },
    demoApiKeysView(),
  ];

  it('starts with the Fleets · Repositories · Business · Products · API keys · Jev tabs, API keys marked', () => {
    for (const v of situations) {
      const html = page(v);
      expect(html.indexOf('class="section-tabs"'), v.kind).toBeGreaterThanOrEqual(0);
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, v.kind).toEqual([['Fleets', false], ['Repositories', false], ['Business', false], ['Products', false], ['API keys', true], ['Jev', false]]);
    }
  });

  it('says why when there are no keys to show', () => {
    expect(page({ kind: 'closed' })).toContain('API keys are not open here');
    expect(page({ kind: 'sign-in' })).toContain('Sign in to see your API keys');
    expect(page({ kind: 'no-workspace' })).toContain('Your account is not in a workspace');
    expect(page({ kind: 'unreadable' })).toContain('Couldn’t load your API keys');
  });

  it('plays the demo as an owner, marked Demo', () => {
    const html = page(demoApiKeysView());
    expect(html).toContain('ask-chip">Demo<');
    expect(buttons(html)).toContain(NEW_KEY);
    expect(rows(html)).toHaveLength(2);
  });
});
