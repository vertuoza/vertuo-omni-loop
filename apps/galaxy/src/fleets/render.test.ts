import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FleetRow } from '../arcade/types';
import { SETTINGS } from '../nav/sidebar.ts';
import { FleetsScreen, type FleetsScreenView } from './FleetsScreen';
import { FleetsView, ONLY_OWNER } from './FleetsView';
import { fleetsReducer, initialState, type FleetsAction, type FleetsState } from './model';
import { MASCOTS } from './store';

// /app/settings/fleets as the server renders it (PRD 400 s3): the owner's view (New fleet, the form with its
// live preview, Edit, Retire confirmed on the page, the retired fleets under a fold with Restore), a
// member's read-only view, and each refusal next to its field.

const fleet = (name: string, over: Partial<FleetRow> = {}): FleetRow => ({
  name, home: null, label: name.toUpperCase(), color: '#d08a4a', motto: '', mascot: null, sort: 10, retired: false, ...over,
});
const BEAVER = fleet('beaver', { mascot: 'beaver', motto: 'Builds the dam.', sort: 10 });
const OCTOPOD = fleet('octopod', { color: '#b07cff', mascot: 'octopod', sort: 20 });
const OLD = fleet('old', { label: 'OLD GUARD', retired: true, sort: 5 });

const state = (...actions: FleetsAction[]): FleetsState => actions.reduce(fleetsReducer, initialState([BEAVER, OCTOPOD, OLD]));
const render = (s: FleetsState, owner = true) => renderToStaticMarkup(createElement(FleetsView, { state: s, owner, mascots: MASCOTS }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]));
/** The markup of one field of the form: its label, its input and what is said about it. */
const field = (html: string, name: string) => {
  const from = html.indexOf(`data-field="${name}"`);
  if (from < 0) return '';
  const rest = html.slice(from + 1);
  const ends = [rest.indexOf('data-field="'), rest.indexOf('class="fleets-preview"'), rest.indexOf('</form>')].filter((i) => i >= 0);
  return rest.slice(0, Math.min(...ends));
};
/** From the element carrying `cls` to where its own tag closes (sections and folds hold no sibling of their kind). */
const section = (html: string, cls: string) => {
  const m = new RegExp(`<(section|details|div) class="${cls}"`).exec(html);
  if (!m) return '';
  const close = `</${m[1]}>`;
  const rest = html.slice(m.index);
  let depth = 0;
  const tag = new RegExp(`<${m[1]}\\b|</${m[1]}>`, 'g');
  for (let t = tag.exec(rest); t; t = tag.exec(rest)) {
    depth += t[0] === close ? -1 : 1;
    if (depth === 0) return rest.slice(0, t.index + close.length);
  }
  return rest;
};

describe('the owner\'s fleets page', () => {
  it('is headed Fleets and lists the active fleets as cards, each drawn with its mascot', () => {
    const html = render(state());
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Fleets');
    const active = section(html, 'fleets-active');
    expect(text(active)).toContain('BEAVER');
    expect(text(active)).toContain('Builds the dam.');
    expect(text(active)).toContain('OCTOPOD');
    expect(active).toMatch(/<svg [^>]*aria-label="BEAVER"/);
    expect(text(active)).not.toContain('OLD GUARD');
  });

  it('offers New fleet, and Edit and Retire on each active fleet', () => {
    const b = buttons(render(state()));
    expect(b).toContain('New fleet');
    expect(b.filter((x) => x === 'Edit')).toHaveLength(2);
    expect(b.filter((x) => x === 'Retire')).toHaveLength(2);
  });

  it('keeps the retired fleets under a fold, each with Restore', () => {
    const fold = section(render(state()), 'fleets-retired');
    expect(fold).toMatch(/^<details/);
    expect(text(fold)).toContain('Retired fleets · 1');
    expect(text(fold)).toContain('OLD GUARD');
    expect(buttons(fold)).toEqual(['Restore']);
  });

  it('New fleet opens the form: label, colour swatches or hex, motto, mascot grid or none', () => {
    const html = render(state({ type: 'new' }));
    expect(field(html, 'label')).toMatch(/<input[^>]*name="label"/);
    const colour = field(html, 'color');
    expect(colour.match(/data-swatch="#[0-9a-f]{6}"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(colour).toMatch(/<input[^>]*name="color"[^>]*value="#d08a4a"/);
    expect(field(html, 'motto')).toMatch(/<input[^>]*name="motto"/);
    const mascot = field(html, 'mascot');
    expect(mascot.match(/<input[^>]*type="radio"[^>]*name="mascot"/g)).toHaveLength(MASCOTS.length + 1);
    expect(text(mascot)).toContain('None');
    expect(buttons(html)).toEqual(expect.arrayContaining(['Create fleet', 'Cancel']));
    expect(buttons(html)).not.toContain('New fleet');
  });

  it('draws a live card preview of the form as it is filled', () => {
    const html = render(state({ type: 'new' }, { type: 'change', field: 'label', value: 'SHARKS' },
      { type: 'change', field: 'color', value: '#2fc6a4' }, { type: 'change', field: 'motto', value: 'Bite first.' },
      { type: 'change', field: 'mascot', value: 'octopod' }));
    const preview = section(html, 'fleets-preview');
    expect(text(preview)).toContain('SHARKS');
    expect(text(preview)).toContain('Bite first.');
    expect(preview).toContain('--fleet:#2fc6a4');
    expect(preview).toMatch(/<svg [^>]*aria-label="SHARKS"/);
  });

  it('draws a fleet with no mascot as a hero in its colour: another colour, another hero', () => {
    const svg = (color: string) => /<svg[\s\S]*?<\/svg>/.exec(section(render(state({ type: 'new' }, { type: 'change', field: 'label', value: 'X' }, { type: 'change', field: 'color', value: color })), 'fleets-preview'))?.[0];
    expect(svg('#2fc6a4')).toBeTruthy();
    expect(svg('#2fc6a4')).not.toBe(svg('#ff6b8a'));
  });

  it('Edit opens the form on the fleet\'s look, saved as Save changes', () => {
    const html = render(state({ type: 'edit', name: 'beaver' }));
    expect(field(html, 'label')).toMatch(/value="BEAVER"/);
    expect(field(html, 'mascot')).toMatch(/value="beaver"[^>]*checked=""|checked=""[^>]*value="beaver"/);
    expect(buttons(html)).toContain('Save changes');
  });

  it('Retire asks on the page before it retires', () => {
    const html = render(state({ type: 'ask-retire', name: 'octopod' }));
    const ask = /<div class="fleets-confirm"[\s\S]*?<\/div>/.exec(html)?.[0] ?? '';
    expect(text(ask)).toContain('Retire OCTOPOD?');
    expect(buttons(ask)).toEqual(['Retire OCTOPOD', 'Keep it']);
  });

  it.each(['label', 'color', 'motto', 'mascot'] as const)('shows a refusal of the %s next to that field, and nowhere else', (name) => {
    const message = `${name}: refused here.`;
    const html = render(state({ type: 'new' }, { type: 'refused', refusal: { field: name, message } }));
    const at = field(html, name);
    expect(text(at)).toContain(message);
    expect(at).toMatch(/aria-invalid="true"/);
    expect(html.split(message)).toHaveLength(2);
  });

  it('shows the cap of 12 active fleets by the list, and the owner-only refusal on the form', () => {
    const full = render(state({ type: 'new' }, { type: 'refused', refusal: { field: 'fleets', message: 'Fleets: at most 12 active. Retire one first.' } }));
    expect(text(section(full, 'fleets-active'))).toContain('Fleets: at most 12 active. Retire one first.');
    const form = render(state({ type: 'new' }, { type: 'refused', refusal: { field: 'form', message: 'Only the workspace’s owner can change its fleets.' } }));
    expect(/<form[\s\S]*?<\/form>/.exec(form)?.[0]).toContain('Only the workspace’s owner can change its fleets.');
  });

  it('shows a refused retire or restore, with no form open, above the list', () => {
    const html = render(state({ type: 'refused', refusal: { field: 'form', message: 'That fleet is no longer in this workspace. Reload the page.' } }));
    expect(text(html)).toContain('That fleet is no longer in this workspace.');
  });

  it('says how to start with no fleet yet', () => {
    const html = renderToStaticMarkup(createElement(FleetsView, { state: initialState([]), owner: true, mascots: MASCOTS }));
    expect(text(html)).toContain('No fleets yet');
    expect(buttons(html)).toContain('New fleet');
    expect(html).not.toContain('fleets-retired');
  });
});

describe('a member\'s fleets page', () => {
  it('shows the same cards, read-only, and says who may change them', () => {
    const html = render(state(), false);
    expect(text(html)).toContain(ONLY_OWNER);
    expect(ONLY_OWNER).toBe('Only @owner can change fleets.');
    expect(text(section(html, 'fleets-active'))).toContain('BEAVER');
    expect(text(section(html, 'fleets-retired'))).toContain('OLD GUARD');
    expect(buttons(html)).toEqual([]);
    expect(html).not.toMatch(/<form|<input/);
  });

  it('never shows a form, even with a draft in its state', () => {
    expect(render(state({ type: 'new' }), false)).not.toMatch(/<form/);
  });
});

describe('/app/settings/fleets in each situation', () => {
  const screen = (view: FleetsScreenView) => renderToStaticMarkup(createElement(FleetsScreen, { view }));
  const h1 = (html: string) => text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '');

  it('with no database, says fleets are not open here', () => {
    expect(h1(screen({ kind: 'closed' }))).toBe('Fleets are not open here');
  });

  it('signed out, sends the person to sign in on the dashboard', () => {
    const html = screen({ kind: 'sign-in' });
    expect(h1(html)).toBe('Sign in to see your fleets');
    expect(html).toContain('href="/app"');
  });

  it('an account in no workspace reads the notice', () => {
    expect(h1(screen({ kind: 'no-workspace' }))).toBe('Your account is not in a workspace');
  });

  it('fleets that cannot be read say so, as an error, never demo fleets', () => {
    const html = screen({ kind: 'unreadable' });
    expect(h1(html)).toBe('Couldn’t load your fleets');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('fleet-card');
  });

  it('the fleets, drawn by the page in the browser, first as the server renders them', () => {
    const owner = screen({ kind: 'fleets', source: { kind: 'demo' }, owner: true, fleets: [BEAVER], mascots: MASCOTS });
    expect(h1(owner)).toBe('Fleets');
    expect(buttons(owner)).toContain('New fleet');
    const member = screen({ kind: 'fleets', source: { kind: 'demo' }, owner: false, fleets: [BEAVER], mascots: MASCOTS });
    expect(text(member)).toContain(ONLY_OWNER);
    expect(buttons(member)).toEqual([]);
  });

  it('starts with the Fleets · Repositories · Business · Jev tabs in every situation, Fleets marked (PRD 733)', () => {
    const views: FleetsScreenView[] = [
      { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' },
      { kind: 'fleets', source: { kind: 'demo' }, owner: true, fleets: [BEAVER], mascots: MASCOTS },
    ];
    for (const view of views) {
      const html = screen(view);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', true], ['Repositories', false], ['Business', false], ['Jev', false]]);
    }
  });
});

describe('the Fleets page in the sidebar (PRD 438, which replaced /app\'s card; under Settings since PRD 572, a Settings page since PRD 733)', () => {
  it('is Settings\' first page, at /app/settings/fleets', () => {
    expect(SETTINGS.pages?.[0]).toEqual({ label: 'Fleets', path: '/app/settings/fleets' });
  });
});
