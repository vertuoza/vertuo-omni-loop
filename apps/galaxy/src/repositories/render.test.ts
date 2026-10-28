import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, removeConfirm, repositoriesReducer, type RepositoriesAction, type RepositoryRow, type SkillsRead } from './model';
import { RepositoriesScreen, type RepositoriesScreenView } from './RepositoriesScreen';
import { MISSING_ONE, NO_ACCESS, ONLY_OWNER, RepositoriesView, type Access } from './RepositoriesView';
import { sure } from '../arcade/test/sure';

// Settings → Repositories as the server renders it (PRD 612 s1): the owner's view (Add repository,
// the switches), a member's read-only view, the empty list, a workspace with no App installation (the
// install link), a repository the App cannot read, and the Add list, which offers only what the App
// can see minus what is listed.

const NOW = Date.parse('2026-10-08T12:00:00Z');
const SETTINGS = 'https://github.com/organizations/demo-org/settings/installations/5001';
const row = (fullName: string, over: Partial<RepositoryRow> = {}): RepositoryRow => ({
  fullName, tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, ...over,
});
const APPS = row('demo-org/nimbus-apps', { collectedAt: '2026-10-08T11:57:00Z' });
const PDF = row('demo-org/pdf-builder', { tracked: false, collectError: 'rate limited' });
const SECRET = row('demo-org/secret');
const INSTALLED: Access = { kind: 'installed', settingsUrl: SETTINGS, reachable: ['demo-org/nimbus-apps', 'demo-org/pdf-builder', 'demo-org/new-one', 'Demo-Org/Another'] };

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
    expect(text(rowOf(html, 'demo-org/nimbus-apps'))).toContain('collected 3 min ago');
    expect(text(rowOf(html, 'demo-org/pdf-builder'))).toContain('last collection failed · retrying');
    expect(text(render([row('demo-org/new')]))).toContain('not collected yet');
  });

  it('offers Add repository, and a Tracked switch the owner can change on each row', () => {
    const html = render([APPS, PDF]);
    expect(buttons(html).map((b) => b.text)).toContain('Add repository');
    const sw = switches(html);
    expect(sw).toHaveLength(2);
    expect(sw.every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('Track demo-org/nimbus-apps'))?.attrs).toContain('aria-checked="true"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('Track demo-org/pdf-builder'))?.attrs).toContain('aria-checked="false"');
  });

  it('links to the installation\'s settings on GitHub for a missing repository', () => {
    const html = render([APPS]);
    expect(text(html)).toContain(MISSING_ONE.replace('→', '').trim());
    expect(html).toContain(`href="${SETTINGS}"`);
  });

  it('shows a repository the App cannot read as such, with the same link, still tracked', () => {
    const html = render([APPS, SECRET]);
    const secret = rowOf(html, 'demo-org/secret');
    expect(text(secret)).toContain(NO_ACCESS);
    expect(secret).toContain(`href="${SETTINGS}"`);
    expect(secret).toContain('aria-checked="true"');
    expect(text(rowOf(html, 'demo-org/nimbus-apps'))).not.toContain(NO_ACCESS);
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
    expect(buttons(offer).map((b) => b.text)).toEqual(['Demo-Org/Another', 'demo-org/new-one']);
    expect(buttons(html).map((b) => b.text)).not.toContain('Add repository');
  });

  it('says when everything the App sees is listed', () => {
    const html = render([APPS], { access: { kind: 'installed', settingsUrl: SETTINGS, reachable: ['demo-org/nimbus-apps'] }, actions: [{ type: 'pick' }] });
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
    expect(text(html)).toContain('demo-org/nimbus-apps');
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
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('of demo-org/nimbus-apps'))?.attrs).toContain('aria-checked="false"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('of vertuoza/vertuo-omni-loop'))?.attrs).toContain('aria-checked="true"');
  });

  it('lets any member switch it, owner or not, but not while a call is on its way', () => {
    expect(ideas(render([APPS], { owner: false })).every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(ideas(render([APPS], { actions: [{ type: 'busy' }] })).every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
  });

  it('links each row to its board', () => {
    expect(rowOf(render([APPS]), 'demo-org/nimbus-apps')).toContain('href="/ideas/demo-org/nimbus-apps"');
  });

  it('turns the board public and private again through its handler', () => {
    const calls: [string, boolean][] = [];
    const on = { pick() {}, toggleSkills() {}, setSkill() {}, close() {}, add() {}, setTracked() {}, setPhase0() {}, setFixWhenAnswered() {}, remove() {}, setPublicIdeas: (name: string, on: boolean) => { calls.push([name, on]); } };
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
    const html = render([APPS, row('vertuoza/vertuo-omni-loop', { phase0: 'server' }), row('demo-org/legacy', { phase0: 'pr' })]);
    const sw = phase0(html);
    expect(sw).toHaveLength(3);
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for demo-org/nimbus-apps'))?.attrs).toContain('aria-checked="false"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for demo-org/legacy'))?.attrs).toContain('aria-checked="false"');
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
    const on = { pick() {}, toggleSkills() {}, setSkill() {}, close() {}, add() {}, setTracked() {}, setPublicIdeas() {}, remove() {}, setFixWhenAnswered() {}, setPhase0: (name: string, to: string) => { calls.push([name, to]); } };
    const view = (r: RepositoryRow) => RepositoriesView({ state: state([r]), owner: true, access: INSTALLED, now: NOW, on });
    press(view(row('a/b')), 'Phase 0 on the server for a/b');
    press(view(row('a/b', { phase0: 'server' })), 'Phase 0 on the server for a/b');
    expect(calls).toEqual([['a/b', 'server'], ['a/b', 'pr']]);
  });
});

describe('the Fix on a runner once answered switch (PRD 2270 s3)', () => {
  const fix = (html: string) => switches(html, 'Fix on a runner once answered for ');
  const on = { pick() {}, toggleSkills() {}, setSkill() {}, close() {}, add() {}, setTracked() {}, setPublicIdeas() {}, setPhase0() {}, remove() {} };

  it('shows each row\'s switch, on by default and off when the row says so', () => {
    const html = render([APPS, row('demo-org/legacy', { fixWhenAnswered: false })]);
    const sw = fix(html);
    expect(sw).toHaveLength(2);
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for demo-org/nimbus-apps'))?.attrs).toContain('aria-checked="true"');
    expect(sw.find((s) => sure(s.attrs, 's.attrs').includes('for demo-org/legacy'))?.attrs).toContain('aria-checked="false"');
    expect(text(rowOf(html, 'demo-org/legacy'))).toContain('Fix on a runner once answered');
  });

  it('lets only the owner switch it, and not while a call is on its way', () => {
    expect(fix(render([APPS])).every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(fix(render([APPS], { owner: false })).every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    expect(fix(render([APPS], { actions: [{ type: 'busy' }] })).every((s) => /disabled=""/.test(sure(s.attrs, 's.attrs')))).toBe(true);
  });

  it('switches it both ways through its handler', () => {
    const calls: [string, boolean][] = [];
    const handlers = { ...on, setFixWhenAnswered: (name: string, to: boolean) => { calls.push([name, to]); } };
    const view = (r: RepositoryRow) => RepositoriesView({ state: state([r]), owner: true, access: INSTALLED, now: NOW, on: handlers });
    press(view(row('a/b')), 'Fix on a runner once answered for a/b');
    press(view(row('a/b', { fixWhenAnswered: false })), 'Fix on a runner once answered for a/b');
    expect(calls).toEqual([['a/b', false], ['a/b', true]]);
  });
});

// Presses the control labelled `label` in a rendered element tree, as a click would.
const press = (node: unknown, label: string): void => {
  if (!node || typeof node !== 'object') return;
  const props = (node as { props?: Record<string, unknown> }).props;
  if (!props) return;
  if (props['aria-label'] === label && typeof props.onClick === 'function') (props.onClick as () => void)();
  const kids = props.children;
  for (const kid of Array.isArray(kids) ? kids.flat(4) : [kids]) press(kid, label);
  if (typeof (node as { type?: unknown }).type === 'function') press(((node as { type: (p: unknown) => unknown }).type)(props), label);
};
describe('removing a repository (PRD 2188 s1)', () => {
  const removes = (html: string) => buttons(html).filter((b) => b.text === 'Remove');
  afterEach(() => { vi.unstubAllGlobals(); });

  it('tells the owner that removing one keeps its history', () => {
    expect(text(render([APPS]))).toContain('Removing one keeps its history.');
    expect(text(render([APPS], { owner: false }))).not.toContain('Removing one keeps its history.');
  });

  it('gives the owner a quiet Remove on every card, after its switches, and a member none', () => {
    const html = render([APPS, PDF, SECRET]);
    expect(removes(html)).toHaveLength(3);
    expect(removes(html).every((b) => sure(b.attrs, 'b.attrs').includes('ask-button quiet'))).toBe(true);
    const apps = rowOf(html, 'demo-org/nimbus-apps');
    expect(apps.indexOf('>Remove<')).toBeGreaterThan(apps.indexOf('aria-label="Track demo-org/nimbus-apps"'));
    expect(removes(render([APPS, PDF], { owner: false }))).toEqual([]);
  });

  it('waits while a call is on its way', () => {
    expect(removes(render([APPS], { actions: [{ type: 'busy' }] })).every((b) => /disabled=""/.test(sure(b.attrs, 'b.attrs')))).toBe(true);
  });

  it('draws no card for a removed repository', () => {
    const html = render([APPS, row('demo-org/nimbusbuild', { removedAt: '2026-10-08T11:00:00Z' })]);
    expect(rowOf(html, 'demo-org/nimbusbuild')).toBe('');
    expect(removes(html)).toHaveLength(1);
  });

  it('takes the card off the list once removed, and Add repository offers it again', () => {
    const removed = row('demo-org/nimbus-apps', { tracked: false, removedAt: '2026-10-08T12:00:00Z' });
    const html = render([APPS, PDF], { actions: [{ type: 'busy' }, { type: 'removed', repository: removed }, { type: 'pick' }] });
    expect(rowOf(html, 'demo-org/nimbus-apps')).toBe('');
    const offer = /<ul class="repositories-offer">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
    expect(buttons(offer).map((b) => b.text)).toContain('demo-org/nimbus-apps');
  });

  it('asks first, naming the products it leaves and the plan repository it clears, and removes only when confirmed', () => {
    const r = row('demo-org/nimbusbuild', { products: [{ id: 'p-1', name: 'Vertuoza' }, { id: 'p-2', name: 'Mobile' }], planProducts: [{ id: 'p-2', name: 'Mobile' }] });
    const asked: string[] = [];
    const removed: string[] = [];
    const on = { pick() {}, toggleSkills() {}, setSkill() {}, close() {}, add() {}, setTracked() {}, setPublicIdeas() {}, setPhase0() {}, setFixWhenAnswered() {}, remove: (name: string) => { removed.push(name); } };
    const view = () => RepositoriesView({ state: state([r]), owner: true, access: INSTALLED, now: NOW, on });

    vi.stubGlobal('window', { confirm: (message: string) => { asked.push(message); return false; } });
    press(view(), 'Remove demo-org/nimbusbuild');
    expect(removed).toEqual([]);

    vi.stubGlobal('window', { confirm: (message: string) => { asked.push(message); return true; } });
    press(view(), 'Remove demo-org/nimbusbuild');
    expect(removed).toEqual(['demo-org/nimbusbuild']);

    expect(asked).toEqual([removeConfirm(r), removeConfirm(r)]);
    expect(asked[0]).toBe('Remove demo-org/nimbusbuild? Its ideas and history are kept, and adding it again brings them back.\nIt leaves Vertuoza, Mobile.\nMobile will have no plan repository.');
  });
});

describe('the removed repositories (PRD 2188 s2)', () => {
  const GONE = row('demo-org/nimbusbuild', { tracked: false, removedAt: '2026-10-08T09:00:00Z' });
  const GONE2 = row('demo-org/old', { tracked: false, removedAt: '2026-10-08T11:30:00Z' });
  const details = (html: string) => /<details[\s\S]*?<\/details>/.exec(html)?.[0] ?? '';

  it('is absent when nothing was removed', () => {
    expect(render([APPS])).not.toContain('<details');
    expect(text(render([APPS]))).not.toContain('Removed (');
  });

  it('counts the removed repositories on a closed line, each with when it was removed, and not in the list', () => {
    const html = render([APPS, GONE, GONE2]);
    const d = details(html);
    expect(d).not.toContain(' open');
    expect(text(d)).toContain('Removed (2)');
    expect(text(sure(/<li[^>]*data-removed="demo-org\/nimbusbuild"[\s\S]*?<\/li>/.exec(d)?.[0], 'li'))).toBe('demo-org/nimbusbuild removed 3 h ago Add back');
    expect(text(d)).toContain('demo-org/old removed 30 min ago');
    expect(rowOf(html, 'demo-org/nimbusbuild')).toBe('');
    expect(text(html)).not.toContain('No repositories yet');
  });

  it('gives Add back to the owner only', () => {
    expect(buttons(render([GONE])).map((b) => b.text)).toContain('Add back');
    const member = render([GONE], { owner: false });
    expect(text(details(member))).toContain('Removed (1)');
    expect(buttons(member).map((b) => b.text)).not.toContain('Add back');
  });

  it('adds back through the page\'s add handler', () => {
    const added: string[] = [];
    const on = { pick() {}, toggleSkills() {}, setSkill() {}, close() {}, add: (name: string) => { added.push(name); }, setTracked() {}, setPublicIdeas() {}, setPhase0() {}, setFixWhenAnswered() {}, remove() {} };
    const view = RepositoriesView({ state: state([GONE]), owner: true, access: INSTALLED, now: NOW, on });
    press(view, 'Add back demo-org/nimbusbuild');
    expect(added).toEqual(['demo-org/nimbusbuild']);
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
    const html = render([row('demo-org/nimbus-apps', { products: [ERP, LOOP] }), row('demo-org/pdf-builder', { products: [LOOP] })]);
    expect(chips(rowOf(html, 'demo-org/nimbus-apps'))).toEqual([{ text: 'Vertuoza', href: '/app/products/p-1' }, { text: 'Omni Loop', href: '/app/products/p-2' }]);
    expect(chips(rowOf(html, 'demo-org/pdf-builder'))).toEqual([{ text: 'Omni Loop', href: '/app/products/p-2' }]);
  });

  it('shows no chip, and never says "Product", for a repository in no product', () => {
    const html = render([APPS, PDF]);
    expect(chips(html)).toEqual([]);
    expect(text(html)).not.toMatch(/product/i);
  });

  it('no longer offers a product select, to an owner or a member', () => {
    for (const owner of [true, false]) {
      const html = render([row('demo-org/nimbus-apps', { products: [ERP] })], { owner });
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
    expect(screen({ kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: [APPS], access: INSTALLED, now: NOW })).toContain('demo-org/nimbus-apps');
  });

  it('starts with the Fleets · Repositories · Business · Products · API keys · Jev · Playbook tabs in every situation, Repositories marked (PRD 733)', () => {
    const views: RepositoriesScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' },
      { kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: [APPS], access: INSTALLED, now: NOW },
    ];
    for (const view of views) {
      const html = renderToStaticMarkup(createElement(RepositoriesScreen, { view }));
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', true], ['Business', false], ['API keys', false], ['Jev', false], ['Playbook', false]]);
    }
  });
});

describe('the Runner skills block (PRD 2313 s3)', () => {
  const READ = {
    skills: [
      { name: 'validate-prd', description: 'Checks a PRD\'s criteria on its preview.', allowed: { by: 'ada', at: '2026-10-21T09:30:00Z' }, gone: false },
      { name: 'release-notes', description: null, allowed: null, gone: false },
      { name: 'seed-demo', description: null, allowed: { by: 'ada', at: '2026-10-02T08:00:00Z' }, gone: true },
    ],
    branch: 'main',
    error: null,
  };
  const opened = (read: SkillsRead, owner = true) => render([APPS], {
    owner,
    actions: [{ type: 'skills-open', repository: APPS.fullName }, { type: 'skills-read', repository: APPS.fullName, read }],
  });
  const skillsOf = (html: string) => html.slice(html.indexOf('<section class="repositories-skills"'), html.indexOf('</section>', html.indexOf('<section class="repositories-skills"')));

  it('is closed by default: a title with no skill under it', () => {
    expect(text(skillsOf(render([APPS])))).toBe('Runner skills');
    expect(render([APPS])).toContain('aria-expanded="false"');
  });

  it('reads while it opens, then lists each /name with its description as the tooltip', () => {
    const reading = render([APPS], { actions: [{ type: 'skills-open', repository: APPS.fullName }] });
    expect(text(skillsOf(reading))).toContain('Reading the skills…');
    const html = skillsOf(opened(READ));
    expect(text(html)).toContain('Runner skills (3)');
    expect(html).toContain('<code title="Checks a PRD&#x27;s criteria on its preview.">/validate-prd</code>');
    expect(html).toContain('<code>/release-notes</code>');
  });

  it('says who allowed a skill and when, and which one is gone from the default branch', () => {
    const block = text(skillsOf(opened(READ)));
    expect(block).toContain('/validate-prd allowed by @ada on 2026-10-21');
    expect(block).toContain('/seed-demo Gone: no longer on main allowed by @ada on 2026-10-02');
    expect(block).not.toContain('/release-notes allowed');
  });

  it('leaves the owner\'s switches on and a member\'s disabled, a gone skill\'s still on', () => {
    const owner = switches(skillsOf(opened(READ)), 'Allow /');
    expect(owner.map((s) => /aria-checked="true"/.test(sure(s.attrs, 's.attrs')))).toEqual([true, false, true]);
    expect(owner.every((s) => !/disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
    const member = switches(skillsOf(opened(READ, false)), 'Allow /');
    expect(member).toHaveLength(3);
    expect(member.every((s) => /disabled/.test(sure(s.attrs, 's.attrs')))).toBe(true);
  });

  it('says why the read failed and keeps the allowed skills listed', () => {
    const block = text(skillsOf(opened({ skills: READ.skills.slice(0, 1), branch: null, error: 'GitHub answered 502' })));
    expect(block).toContain('Skills could not be read: GitHub answered 502');
    expect(block).toContain('/validate-prd');
  });

  it('is closed again by skills-close', () => {
    const closed = render([APPS], { actions: [{ type: 'skills-open', repository: APPS.fullName }, { type: 'skills-close', repository: APPS.fullName }] });
    expect(text(skillsOf(closed))).toBe('Runner skills');
  });
});
