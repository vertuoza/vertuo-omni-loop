import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialState, repositoriesReducer, type RepositoriesAction, type RepositoryRow } from './model';
import { RepositoriesScreen, type RepositoriesScreenView } from './RepositoriesScreen';
import { MISSING_ONE, NO_ACCESS, ONLY_OWNER, RepositoriesView, type Access } from './RepositoriesView';

// Settings → Repositories as the server renders it (PRD 612 s1): the owner's view (Add repository,
// the switches), a member's read-only view, the empty list, a workspace with no App installation (the
// install link), a repository the App cannot read, and the Add list, which offers only what the App
// can see minus what is listed.

const NOW = Date.parse('2026-10-08T12:00:00Z');
const SETTINGS = 'https://github.com/organizations/vertuoza/settings/installations/5001';
const row = (fullName: string, over: Partial<RepositoryRow> = {}): RepositoryRow => ({
  fullName, tracked: true, collectedAt: null, collectError: null, product: null, ...over,
});
const APPS = row('vertuoza/vertuo-apps', { collectedAt: '2026-10-08T11:57:00Z' });
const PDF = row('vertuoza/pdf-builder', { tracked: false, collectError: 'rate limited' });
const SECRET = row('vertuoza/secret');
const INSTALLED: Access = { kind: 'installed', settingsUrl: SETTINGS, reachable: ['vertuoza/vertuo-apps', 'vertuoza/pdf-builder', 'vertuoza/new-one', 'Vertuoza/Another'] };

const state = (rows: RepositoryRow[], ...actions: RepositoriesAction[]) => actions.reduce(repositoriesReducer, initialState(rows));
const render = (rows: RepositoryRow[], { owner = true, access = INSTALLED as Access, actions = [] as RepositoriesAction[] } = {}) =>
  renderToStaticMarkup(createElement(RepositoriesView, { state: state(rows, ...actions), owner, access, now: NOW }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(m[2]) }));
const switches = (html: string) => buttons(html).filter((b) => b.attrs.includes('role="switch"'));
const rowOf = (html: string, name: string) => {
  const from = html.indexOf(`data-repository="${name}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};

describe('the owner\'s repositories page', () => {
  it('is headed Repositories and lists each repository with when it was last collected', () => {
    const html = render([APPS, PDF]);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Repositories');
    expect(text(rowOf(html, 'vertuoza/vertuo-apps'))).toContain('collected 3 min ago');
    expect(text(rowOf(html, 'vertuoza/pdf-builder'))).toContain('last collection failed · retrying');
    expect(text(render([row('vertuoza/new')]))).toContain('not collected yet');
  });

  it('offers Add repository, and a Tracked switch the owner can change on each row', () => {
    const html = render([APPS, PDF]);
    expect(buttons(html).map((b) => b.text)).toContain('Add repository');
    const sw = switches(html);
    expect(sw).toHaveLength(2);
    expect(sw.every((s) => !/disabled/.test(s.attrs))).toBe(true);
    expect(sw.find((s) => s.attrs.includes('Track vertuoza/vertuo-apps'))?.attrs).toContain('aria-checked="true"');
    expect(sw.find((s) => s.attrs.includes('Track vertuoza/pdf-builder'))?.attrs).toContain('aria-checked="false"');
  });

  it('links to the installation\'s settings on GitHub for a missing repository', () => {
    const html = render([APPS]);
    expect(text(html)).toContain(MISSING_ONE.replace('→', '').trim());
    expect(html).toContain(`href="${SETTINGS}"`);
  });

  it('shows a repository the App cannot read as such, with the same link, still tracked', () => {
    const html = render([APPS, SECRET]);
    const secret = rowOf(html, 'vertuoza/secret');
    expect(text(secret)).toContain(NO_ACCESS);
    expect(secret).toContain(`href="${SETTINGS}"`);
    expect(secret).toContain('aria-checked="true"');
    expect(text(rowOf(html, 'vertuoza/vertuo-apps'))).not.toContain(NO_ACCESS);
  });

  it('says nothing of access when the App\'s listing could not be read', () => {
    expect(text(render([SECRET], { access: { kind: 'installed', settingsUrl: SETTINGS, reachable: null } }))).not.toContain(NO_ACCESS);
  });

  it('says the list is empty, and how to fill it', () => {
    expect(text(render([]))).toContain('No repositories yet. Add one from the repositories the Omni App can see.');
  });
});

describe('the Add list', () => {
  it('offers only what the App can see and is not listed, one button each, by name', () => {
    const html = render([APPS, PDF], { actions: [{ type: 'pick' }] });
    const offer = /<ul class="repositories-offer">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
    expect(buttons(offer).map((b) => b.text)).toEqual(['Vertuoza/Another', 'vertuoza/new-one']);
    expect(buttons(html).map((b) => b.text)).not.toContain('Add repository');
  });

  it('says when everything the App sees is listed', () => {
    const html = render([APPS], { access: { kind: 'installed', settingsUrl: SETTINGS, reachable: ['vertuoza/vertuo-apps'] }, actions: [{ type: 'pick' }] });
    expect(text(html)).toContain('Every repository the Omni App can see is already listed.');
  });

  it('says when the App\'s repositories could not be read', () => {
    const html = render([APPS], { access: { kind: 'installed', settingsUrl: SETTINGS, reachable: null }, actions: [{ type: 'pick' }] });
    expect(text(html)).toContain('Couldn’t read the repositories the Omni App can see.');
  });

  it('shows a refusal above the list', () => {
    const html = render([APPS], { actions: [{ type: 'busy' }, { type: 'refused', message: 'Only the workspace’s owner can change its repositories.' }] });
    expect(html).toMatch(/role="alert">Only the workspace’s owner can change its repositories\.</);
  });
});

describe('a member\'s repositories page', () => {
  it('reads the same list, with no Add button and no switch they can change', () => {
    const html = render([APPS, PDF], { owner: false });
    expect(text(html)).toContain(ONLY_OWNER);
    expect(text(html)).toContain('vertuoza/vertuo-apps');
    expect(buttons(html).map((b) => b.text)).not.toContain('Add repository');
    const sw = switches(html);
    expect(sw).toHaveLength(2);
    expect(sw.every((s) => /disabled=""/.test(s.attrs))).toBe(true);
  });

  it('says the owner adds them, when the list is empty', () => {
    expect(text(render([], { owner: false }))).toContain('No repositories yet. The workspace’s owner adds them.');
  });
});

describe('a workspace with no App installation', () => {
  it('links to installing the App, and offers no Add button', () => {
    const html = render([], { access: { kind: 'none', installUrl: 'https://github.com/apps/omni-loop/installations/new' } });
    expect(text(html)).toContain('The Omni App is not installed');
    expect(html).toContain('href="https://github.com/apps/omni-loop/installations/new"');
    expect(buttons(html).map((b) => b.text)).not.toContain('Add repository');
    expect(text(html)).not.toContain(MISSING_ONE.replace('→', '').trim());
  });
});

describe('products (PRD 748 s4)', () => {
  const ERP = { id: 'p-1', name: 'Vertuoza' };
  const LOOP = { id: 'p-2', name: 'Omni Loop' };
  const withProducts = (rows: RepositoryRow[], products: { id: string; name: string }[], { owner = true, actions = [] as RepositoriesAction[] } = {}) =>
    renderToStaticMarkup(createElement(RepositoriesView, { state: state(rows, ...actions), owner, access: INSTALLED, now: NOW, products }));
  const selects = (html: string) => [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].map((m) => ({
    attrs: m[1],
    options: [...m[2].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)].map((o) => ({ value: /value="([^"]*)"/.exec(o[1])?.[1], text: o[2], selected: o[1].includes('selected') })),
  }));

  it('shows no product select, and never says "Product", while the business has one or none', () => {
    for (const products of [[], [ERP]]) {
      const html = withProducts([APPS, PDF], products);
      expect(selects(html)).toHaveLength(0);
      expect(text(html)).not.toMatch(/product/i);
    }
  });

  it('gives each row a product select once there are two, on the repository\'s product', () => {
    const html = withProducts([row('vertuoza/vertuo-apps', { product: 'p-1' }), row('vertuoza/vertuo-omni-loop', { product: 'p-2' })], [ERP, LOOP]);
    const all = selects(html);
    expect(all).toHaveLength(2);
    expect(all[0].attrs).toContain('aria-label="Product of vertuoza/vertuo-apps"');
    expect(all[0].options.map((o) => o.text)).toEqual(['Vertuoza', 'Omni Loop']);
    expect(all[0].options.find((o) => o.selected)?.text).toBe('Vertuoza');
    expect(selects(rowOf(html, 'vertuoza/vertuo-omni-loop'))[0].options.find((o) => o.selected)?.text).toBe('Omni Loop');
    expect(text(html)).toContain('Each repository’s agents read its product’s business.');
  });

  it('offers a repository with no product a disabled placeholder first', () => {
    const [only] = selects(withProducts([APPS], [ERP, LOOP]));
    expect(only.options[0]).toEqual({ value: '', text: 'Choose…', selected: true });
    expect(only.options.slice(1).map((o) => o.text)).toEqual(['Vertuoza', 'Omni Loop']);
  });

  it('lets a member change it too, but not while a call is on its way', () => {
    expect(selects(withProducts([APPS], [ERP, LOOP], { owner: false }))[0].attrs).not.toContain('disabled');
    expect(selects(withProducts([APPS], [ERP, LOOP], { actions: [{ type: 'busy' }] }))[0].attrs).toContain('disabled');
  });

  it('wraps the select under the name at 393 px', () => {
    const css = readFileSync(fileURLToPath(new URL('./repositories.css', import.meta.url)), 'utf8');
    const at = css.lastIndexOf('.repositories-product {');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(css.slice(at, css.indexOf('}', at))).toContain('max-width: 100%');
  });
});

describe('the page\'s situations', () => {
  const screen = (view: RepositoriesScreenView) => text(renderToStaticMarkup(createElement(RepositoriesScreen, { view })));

  it('says what is wrong when there is no list to show', () => {
    expect(screen({ kind: 'closed' })).toContain('Repositories are not open here');
    expect(screen({ kind: 'sign-in' })).toContain('Sign in to see your repositories');
    expect(screen({ kind: 'no-workspace' })).toContain('Your account is not in a workspace');
    expect(screen({ kind: 'unreadable' })).toContain('Couldn’t load your repositories');
  });

  it('draws the list otherwise', () => {
    expect(screen({ kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: [APPS], access: INSTALLED, now: NOW })).toContain('vertuoza/vertuo-apps');
  });

  it('starts with the Fleets · Repositories · Business tabs in every situation, Repositories marked (PRD 733)', () => {
    const views: RepositoriesScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' },
      { kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: [APPS], access: INSTALLED, now: NOW },
    ];
    for (const view of views) {
      const html = renderToStaticMarkup(createElement(RepositoriesScreen, { view }));
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', true], ['Business', false]]);
    }
  });
});
