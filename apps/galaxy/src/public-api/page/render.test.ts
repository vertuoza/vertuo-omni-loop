import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ApiKey } from '../keys/api-keys.contract';
import { GITHUB_REFUSED, NOT_AVAILABLE } from '../keys/api-keys.service';
import { ApiKeysPage } from './ApiKeysPage';
import {
  ALL_REPOSITORIES, API_REFERENCE, ApiKeysView, ATTACH, ATTACH_APP, CHOOSE_FILE, GITHUB_APP, NEW_KEY, NO_KEY_YET, NOT_AGAIN, NOT_WORKING, ONLY_OWNERS, REMOVE,
  REMOVE_FOR_GOOD, REPLACE, REVOKE, REVOKE_FOR_GOOD,
} from './ApiKeysView';
import { demoApiKeysView } from './demo';
import { apiKeysReducer, initialApiKeysState, type ApiKeysPageView, type ApiKeysState } from './model';

// Settings › API keys drawn (PRD 2022 s1; the `api-keys` screen of the design library): an owner's view,
// a member's, no key yet, the key just made, and every situation under the Settings tabs. PRD 2433 s5 adds
// each key's GitHub App: its column for every member, an owner's last token and actions, and the attach form
// with its refusals.

const NOW = new Date('2026-10-15T12:00:00Z');
const SECRET = `oma_Xk3vQ2nB7tY0pLm4sWc8dR1hJ6uZ${'A'.repeat(11)}9fQe`;
// A private key's shape, built at runtime so no key sits in the source (the open-source guard).
const PEM = ['-----BEGIN RSA PRIVATE KEY-----', 'MIIEowIBAAKCAQEAnotforshow', '-----END RSA PRIVATE KEY-----', ''].join('\n');
const key = (id: string, name: string, more: Partial<ApiKey> = {}): ApiKey => ({
  id, name, lastFour: '9fQe', repos: [], createdAt: '2026-10-15T09:00:00Z', lastUsedAt: null, revokedAt: null,
  maker: { id: 'u-1', login: 'pierrederval', name: null }, working: true, ...more,
});
const QA = key('k-1', 'QA dashboard', {
  repos: ['demo-org/backend-php'], lastUsedAt: '2026-10-15T11:58:00Z', githubApp: { slug: 'acme-fixer', lastTokenAt: '2026-10-14T08:00:00Z' },
});
const DIGEST = key('k-2', 'Weekly digest', { lastFour: 'A1c0', maker: { id: 'u-2', login: 'irisa', name: null }, githubApp: null });

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

  it('lists each key: its name, who made it and when, oma_… and its last four, its repositories, its GitHub App, when last used, and Revoke', () => {
    const [qa, digest] = rows(html);
    expect(qa?.id).toBe('k-1');
    expect(text(qa?.html ?? '')).toContain(`QA dashboard @pierrederval · 15 Oct 2026 oma_…9fQe backend-php ${GITHUB_APP} acme-fixer last token 14 Oct 2026 ${REPLACE} ${REMOVE} Last used 2 min ago Revoke`);
    expect(qa?.html).toContain('title="demo-org/backend-php"');
    expect(text(digest?.html ?? '')).toContain(`Weekly digest @irisa · 15 Oct 2026 oma_…A1c0 ${ALL_REPOSITORIES} ${GITHUB_APP} — ${ATTACH_APP} Last used Never Revoke`);
    expect(html).toContain(`aria-label="${REVOKE} QA dashboard"`);
    expect(html).not.toContain(ONLY_OWNERS);
  });

  it('asks Revoke a second time before it revokes', () => {
    const asked = view(apiKeysReducer(initialApiKeysState([QA, DIGEST]), { type: 'confirm', id: 'k-1' }), true);
    expect(buttons(rows(asked)[0]?.html ?? '')).toEqual([REPLACE, REMOVE, REVOKE_FOR_GOOD, 'Keep']);
    expect(buttons(rows(asked)[1]?.html ?? '')).toEqual([ATTACH_APP, REVOKE]);
  });

  it('opens the New key form with a name, All repositories, or a pick among the tracked ones', () => {
    const open = apiKeysReducer(initialApiKeysState([]), { type: 'open' });
    const form = view(open, true, ['demo-org/backend-php', 'demo-org/web']);
    expect(form).toContain('<form class="api-keys-form" aria-label="New key">');
    expect(form).toMatch(/<input type="text" maxLength="40"[^>]* name="name"/);
    expect(text(form)).toContain(`Repositories ${ALL_REPOSITORIES} Only these:`);
    expect(buttons(form)).not.toContain(NEW_KEY);
    expect(form).not.toContain('demo-org/web');
    const picking = view(apiKeysReducer(open, { type: 'all', all: false }), true, ['demo-org/backend-php', 'demo-org/web']);
    expect(picking).toContain('value="demo-org/backend-php"');
    expect(picking).toContain('value="demo-org/web"');
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

  it('reads each key’s GitHub App, its slug or —, and never its last token or an action', () => {
    const heads = [...html.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual(['Name', 'Key', 'Repositories', GITHUB_APP, 'Last used']);
    const [qa, digest] = rows(html);
    expect(text(qa?.html ?? '')).toContain(`backend-php ${GITHUB_APP} acme-fixer Last used 2 min ago`);
    expect(text(digest?.html ?? '')).toContain(`${ALL_REPOSITORIES} ${GITHUB_APP} — Last used Never`);
    expect(html).not.toMatch(/last token|no token yet|2026-10-14T08/);
    expect(html).not.toContain(ATTACH_APP);
  });

  it('shows no attach form even to a state that holds one', () => {
    const state = apiKeysReducer(initialApiKeysState([QA, DIGEST]), { type: 'attach-open', key: DIGEST });
    expect(view(state, false)).not.toContain('<form');
  });
});

describe('an owner’s GitHub App column', () => {
  const html = view(initialApiKeysState([QA, DIGEST, key('k-3', 'Nightly audit', { githubApp: { slug: 'acme-triage', lastTokenAt: null } })]), true);
  const [qa, digest, nightly] = rows(html);

  it('heads the column after Repositories, for an owner as for a member', () => {
    const heads = [...html.matchAll(/<th scope="col">(?:<span[^>]*>)?([^<]*)(?:<\/span>)?<\/th>/g)].map((m) => m[1]);
    expect(heads).toEqual(['Name', 'Key', 'Repositories', GITHUB_APP, 'Last used', REVOKE]);
  });

  it('says under the slug when it last minted a token, or that it has none yet', () => {
    expect(text(qa?.html ?? '')).toContain('acme-fixer last token 14 Oct 2026');
    expect(text(nightly?.html ?? '')).toContain('acme-triage no token yet');
    expect(text(digest?.html ?? '')).not.toMatch(/last token|no token yet/);
  });

  it('gives Attach a GitHub App to a key with none, and Replace and Remove to a key with one', () => {
    expect(buttons(qa?.html ?? '')).toEqual([REPLACE, REMOVE, REVOKE]);
    expect(buttons(nightly?.html ?? '')).toEqual([REPLACE, REMOVE, REVOKE]);
    expect(buttons(digest?.html ?? '')).toEqual([ATTACH_APP, REVOKE]);
    expect(html).toContain(`aria-label="${ATTACH_APP} to Weekly digest"`);
    expect(html).toContain(`aria-label="${REPLACE} the GitHub App of QA dashboard"`);
    expect(html).toContain(`aria-label="${REMOVE} the GitHub App of QA dashboard"`);
  });

  it('asks Remove a second time, Remove for good and Cancel, on that key alone', () => {
    const asked = view(apiKeysReducer(initialApiKeysState([QA, DIGEST]), { type: 'remove-confirm', id: 'k-1' }), true);
    expect(buttons(rows(asked)[0]?.html ?? '')).toEqual([REMOVE_FOR_GOOD, 'Cancel', REVOKE]);
    expect(buttons(rows(asked)[1]?.html ?? '')).toEqual([ATTACH_APP, REVOKE]);
    expect(text(rows(asked)[0]?.html ?? '')).toContain('acme-fixer last token 14 Oct 2026');
  });

  it('keeps every other button quiet: the page’s one primary action stays New key', () => {
    const primaries = [...html.matchAll(/<button [^>]*class="ask-button"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(primaries).toEqual([NEW_KEY]);
  });
});

describe('the attach form', () => {
  const keys = [QA, DIGEST];
  const open = (...actions: Parameters<typeof apiKeysReducer>[1][]) =>
    actions.reduce(apiKeysReducer, apiKeysReducer(initialApiKeysState(keys), { type: 'attach-open', key: DIGEST }));
  const form = (html: string) => /<form class="api-keys-form" aria-label="Attach a GitHub App">[\s\S]*?<\/form>/.exec(html)?.[0] ?? '';
  const primaries = (html: string) => [...html.matchAll(/<button [^>]*class="ask-button"[^>]*>([^<]*)</g)].map((m) => m[1]);

  it('opens above the table, from Attach a GitHub App or Replace, with the App ID, the private key file, Attach and Cancel', () => {
    const html = view(open(), true);
    expect(html.indexOf('aria-label="Attach a GitHub App"')).toBeGreaterThan(0);
    expect(html.indexOf('aria-label="Attach a GitHub App"')).toBeLessThan(html.indexOf('<table'));
    expect(text(form(html))).toBe(` Attach a GitHub App to Weekly digest App ID Private key file ${CHOOSE_FILE} ${ATTACH} Cancel `);
    expect(form(html)).toMatch(/<input[^>]*type="text"[^>]*name="appId"/);
    expect(form(html)).toMatch(/<input[^>]*type="file"[^>]*accept="\.pem[^"]*"/);
    const replace = view(apiKeysReducer(initialApiKeysState(keys), { type: 'attach-open', key: QA }), true);
    expect(text(form(replace))).toContain('Attach a GitHub App to QA dashboard App ID Private key file');
  });

  it('makes Attach the one primary action while it is open, and New key quiet', () => {
    const html = view(open(), true);
    expect(primaries(html)).toEqual([ATTACH]);
    expect(html).toContain(`class="ask-button quiet">${NEW_KEY}<`);
    expect(buttons(form(html))).toEqual([ATTACH, 'Cancel']);
  });

  it('holds Attach back until the App ID and the file are given, and says which file', () => {
    expect(form(view(open(), true))).toMatch(/<button type="submit" class="ask-button" disabled="">Attach</);
    const given = view(open({ type: 'attach-id', appId: '3141592' }, { type: 'attach-file', file: { name: 'acme-fixer.pem', text: PEM } }), true);
    expect(form(given)).not.toMatch(/disabled=""[^>]*>Attach</);
    expect(form(given)).toContain('value="3141592"');
    expect(text(form(given))).toContain(`${CHOOSE_FILE} acme-fixer.pem`);
  });

  it('keeps the quiet Copy and the key just made while the form is open, so there is one primary action', () => {
    const made = apiKeysReducer(initialApiKeysState([DIGEST]), { type: 'made', key: QA, secret: SECRET, origin: 'https://www.omni-loop.xyz' });
    const html = view(apiKeysReducer(made, { type: 'attach-open', key: DIGEST }), true);
    expect(html).toContain(`<code data-secret="true">${SECRET}</code>`);
    expect(primaries(html)).toEqual([ATTACH]);
  });

  it('says GitHub’s refusal of the pair under the form, word for word, and nothing is stored', () => {
    const html = view(open({ type: 'attach-id', appId: '3141592' }, { type: 'attach-file', file: { name: 'acme-fixer.pem', text: PEM } }, { type: 'busy' }, { type: 'refused', message: GITHUB_REFUSED }), true);
    expect(html).toContain(`<p class="api-keys-refusal" role="alert">${GITHUB_REFUSED}</p>`);
    expect(html.indexOf('</form>')).toBeLessThan(html.indexOf('role="alert"'));
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('<table'));
    expect(form(html)).toContain('value="3141592"');
    expect(text(rows(html)[1]?.html ?? '')).toContain(`${GITHUB_APP} — ${ATTACH_APP}`);
  });

  it('says a deployment with no master key cannot attach, word for word', () => {
    const html = view(open({ type: 'refused', message: NOT_AVAILABLE }), true);
    expect(html).toContain(`role="alert">${NOT_AVAILABLE.replace('\'', '&#x27;')}</p>`);
    expect(text(html)).toContain(NOT_AVAILABLE);
  });

  it('never draws the private key that was chosen', () => {
    const html = view(open({ type: 'attach-id', appId: '3141592' }, { type: 'attach-file', file: { name: 'acme-fixer.pem', text: PEM } }), true);
    expect(html).not.toContain('MIIEow');
    expect(html).not.toContain('BEGIN RSA');
  });

  it('closes on Cancel and once attached, leaving the slug and no token yet on the row', () => {
    const attached = view(open({ type: 'busy' }, { type: 'attached', id: 'k-2', slug: 'acme-triage' }), true);
    expect(attached).not.toContain('<form');
    expect(text(rows(attached)[1]?.html ?? '')).toContain(`${GITHUB_APP} acme-triage no token yet ${REPLACE} ${REMOVE}`);
    expect(view(open({ type: 'attach-close' }), true)).not.toContain('<form');
  });

  it('leaves the New key form as it was', () => {
    const html = view(apiKeysReducer(initialApiKeysState(keys), { type: 'open' }), true, ['demo-org/backend-php']);
    expect(html).toContain('<form class="api-keys-form" aria-label="New key">');
    expect(html).not.toContain('Attach a GitHub App"');
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
      expect(tabs, v.kind).toEqual([['Fleets', false], ['Repositories', false], ['Business', false], ['API keys', true], ['Jev', false]]);
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

  it('plays the demo’s GitHub Apps: the first key’s slug and last token, an Attach on the second', () => {
    const [qa, digest] = rows(page(demoApiKeysView()));
    expect(text(qa?.html ?? '')).toContain(`${GITHUB_APP} acme-fixer last token 14 Oct 2026 ${REPLACE} ${REMOVE}`);
    expect(text(digest?.html ?? '')).toContain(`${GITHUB_APP} — ${ATTACH_APP}`);
  });

  it('shows a member the slug and none of the actions, in the page as in the view', () => {
    const html = page({ kind: 'keys', source: { kind: 'database', workspace: 'ws-1' }, owner: false, keys: [QA, DIGEST], tracked: [] });
    expect(text(html)).toContain(`${GITHUB_APP} acme-fixer`);
    expect(html).not.toMatch(/last token|no token yet/);
    expect(buttons(html)).toEqual([]);
  });
});
