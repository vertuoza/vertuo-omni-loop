import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialState, repositoriesReducer, type RepositoriesAction, type RepositoryRow } from './model';
import { RepositoriesScreen, type RepositoriesScreenView } from './RepositoriesScreen';
import { MISSING_ONE, NO_ACCESS, ONLY_OWNER, RepositoriesView, type Access } from './RepositoriesView';
import { sure } from '../arcade/test/sure';

// Settings → Repositories as the server renders it (PRD 612 s1): the owner's view (Add repository,
// the switches), a member's read-only view, the empty list, a workspace with no App installation (the
// install link), a repository the App cannot read, and the Add list, which offers only what the App
// can see minus what is listed.

const NOW = Date.parse('2026-10-08T12:00:00Z');
const SETTINGS = 'https://github.com/organizations/vertuoza/settings/installations/5001';
const row = (fullName: string, over: Partial<RepositoryRow> = {}): RepositoryRow => ({
  fullName, tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, ...over,
});
const APPS = row('vertuoza/vertuo-apps', { collectedAt: '2026-10-08T11:57:00Z' });
const PDF = row('vertuoza/pdf-builder', { tracked: false, collectError: 'rate limited' });
const SECRET = row('vertuoza/secret');
const INSTALLED: Access = { kind: 'installed', settingsUrl: SETTINGS, reachable: ['vertuoza/vertuo-apps', 'vertuoza/pdf-builder', 'vertuoza/new-one', 'Vertuoza/Another'] };

const state = (rows: RepositoryRow[], ...actions: RepositoriesAction[]) => actions.reduce(repositoriesReducer, initialState(rows));
const render = (rows: RepositoryRow[], { owner = true, access = INSTALLED, actions = [] }: { owner?: boolean; access?: Access; actions?: RepositoriesAction[] } = {}) =>
  renderToStaticMarkup(createElement(RepositoriesView, { state: state(rows, ...actions), owner, access, now: NOW }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(sure(m[2], 'm[2]')) }));
const switches = (html: string, name = 'Track ') => buttons(html).filter((b) => sure(b.attrs, 'b.attrs').includes('role="switch"') && sure(b.attrs, 'b.attrs').includes(`aria-label="${name}`));
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
    expect(sw.every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('Track vertuoza/vertuo-apps'))?.attrs).toContain('aria-checked="true"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('Track vertuoza/pdf-builder'))?.attrs).toContain('aria-checked="false"');
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
    expect(sw.every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
  });

  it('says the owner adds them, when the list is empty', () => {
    expect(text(render([], { owner: false }))).toContain('No repositories yet. The workspace’s owner adds them.');
  });
});

describe('the ideas board switch (PRD 1246 s4)', () => {
  const ideas = (html: string) => switches(html, 'Public ideas board of ');

  it('gives each row a Public ideas switch, on while its board is public', () => {
    const html = render([APPS, row('vertuoza/vertuo-omni-loop', { publicIdeas: true })]);
    const sw = ideas(html);
    expect(sw).toHaveLength(2);
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('of vertuoza/vertuo-apps'))?.attrs).toContain('aria-checked="false"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('of vertuoza/vertuo-omni-loop'))?.attrs).toContain('aria-checked="true"');
  });

  it('lets any member switch it, owner or not, but not while a call is on its way', () => {
    expect(ideas(render([APPS], { owner: false })).every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(ideas(render([APPS], { actions: [{ type: 'busy' }] })).every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
  });

  it('links each row to its board', () => {
    expect(rowOf(render([APPS]), 'vertuoza/vertuo-apps')).toContain('href="/ideas/vertuoza/vertuo-apps"');
  });

  it('turns the board public and private again through its handler', () => {
    const calls: [string, boolean][] = [];
    const on = { pick() {}, close() {}, add() {}, setTracked() {}, setPhase0() {}, setPublicIdeas: (name: string, on: boolean) => { calls.push([name, on]); } };
    const tree = RepositoriesView({ state: state([row('a/b', { publicIdeas: true })]), owner: false, access: INSTALLED, now: NOW, on });
    const press = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const props = (node as { props?: Record<string, unknown> }).props;
      if (!props) return;
      if (props['aria-label'] === 'Public ideas board of a/b' && typeof props.onClick === 'function') (props.onClick as () => void)();
      const kids = props.children;
      for (const kid of Array.isArray(kids) ? kids.flat(4) : [kids]) press(kid);
      if (typeof (node as { type?: unknown }).type === 'function') press(((node as { type: (p: unknown) => unknown }).type)(props));
    };
    press(tree);
    expect(calls).toEqual([['a/b', false]]);
  });
});

describe('the phase 0 switch (PRD 1299 s1)', () => {
  const phase0 = (html: string) => switches(html, 'Phase 0 on the server for ');
  const press = (node: unknown, label: string): void => {
    if (!node || typeof node !== 'object') return;
    const props = (node as { props?: Record<string, unknown> }).props;
    if (!props) return;
    if (props['aria-label'] === label && typeof props.onClick === 'function') (props.onClick as () => void)();
    const kids = props.children;
    for (const kid of Array.isArray(kids) ? kids.flat(4) : [kids]) press(kid, label);
    if (typeof (node as { type?: unknown }).type === 'function') press(((node as { type: (p: unknown) => unknown }).type)(props), label);
  };

  it('shows each row\'s flag, on while its phase 0 is approved on the server, off for pr or a row that does not say', () => {
    const html = render([APPS, row('vertuoza/vertuo-omni-loop', { phase0: 'server' }), row('vertuoza/legacy', { phase0: 'pr' })]);
    const sw = phase0(html);
    expect(sw).toHaveLength(3);
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for vertuoza/vertuo-apps'))?.attrs).toContain('aria-checked="false"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for vertuoza/legacy'))?.attrs).toContain('aria-checked="false"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for vertuoza/vertuo-omni-loop'))?.attrs).toContain('aria-checked="true"');
    expect(text(rowOf(html, 'vertuoza/vertuo-omni-loop'))).toContain('Phase 0 on the server');
  });

  it('lets only the owner switch it, and not while a call is on its way', () => {
    expect(phase0(render([APPS, PDF]))).toHaveLength(2);
    expect(phase0(render([APPS])).every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(phase0(render([APPS], { owner: false }))).toHaveLength(1);
    expect(phase0(render([APPS], { owner: false })).every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(phase0(render([APPS], { actions: [{ type: 'busy' }] })).every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
  });

  it('switches it both ways through its handler', () => {
    const calls: [string, string][] = [];
    const on = { pick() {}, close() {}, add() {}, setTracked() {}, setPublicIdeas() {}, setPhase0: (name: string, to: string) => { calls.push([name, to]); } };
    const view = (r: RepositoryRow) => RepositoriesView({ state: state([r]), owner: true, access: INSTALLED, now: NOW, on });
    press(view(row('a/b')), 'Phase 0 on the server for a/b');
    press(view(row('a/b', { phase0: 'server' })), 'Phase 0 on the server for a/b');
    expect(calls).toEqual([['a/b', 'server'], ['a/b', 'pr']]);
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

describe('each repository\'s products, as chips (PRD 1364 s11)', () => {
  const ERP = { id: 'p-1', name: 'Vertuoza' };
  const LOOP = { id: 'p-2', name: 'Omni Loop' };
  const chips = (html: string) => [...html.matchAll(/<a [^>]*class="repositories-product-chip"[^>]*>([^<]*)<\/a>/g)].map((m) => ({ text: m[1], href: /href="([^"]*)"/.exec(m[0])?.[1] }));

  it('shows each product a repository is in as a chip linking to that product\'s home', () => {
    const html = render([row('vertuoza/vertuo-apps', { products: [ERP, LOOP] }), row('vertuoza/pdf-builder', { products: [LOOP] })]);
    expect(chips(rowOf(html, 'vertuoza/vertuo-apps'))).toEqual([{ text: 'Vertuoza', href: '/app/products/p-1' }, { text: 'Omni Loop', href: '/app/products/p-2' }]);
    expect(chips(rowOf(html, 'vertuoza/pdf-builder'))).toEqual([{ text: 'Omni Loop', href: '/app/products/p-2' }]);
  });

  it('shows no chip, and never says "Product", for a repository in no product', () => {
    const html = render([APPS, PDF]);
    expect(chips(html)).toEqual([]);
    expect(text(html)).not.toMatch(/product/i);
  });

  it('no longer offers a product select, to an owner or a member', () => {
    for (const owner of [true, false]) {
      const html = render([row('vertuoza/vertuo-apps', { products: [ERP] })], { owner });
      expect(html).not.toContain('<select');
    }
  });

  it('wraps the chips under the name at 393 px', () => {
    const css = readFileSync(fileURLToPath(new URL('./repositories.css', import.meta.url)), 'utf8');
    const at = css.lastIndexOf('.repositories-products {');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(css.slice(at, css.indexOf('}', at))).toContain('flex-wrap: wrap');
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

  it('starts with the Fleets · Repositories · Business · Products · Jev tabs in every situation, Repositories marked (PRD 733)', () => {
    const views: RepositoriesScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' },
      { kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: [APPS], access: INSTALLED, now: NOW },
    ];
    for (const view of views) {
      const html = renderToStaticMarkup(createElement(RepositoriesScreen, { view }));
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', true], ['Business', false], ['Products', false], ['Jev', false]]);
    }
  });
});
