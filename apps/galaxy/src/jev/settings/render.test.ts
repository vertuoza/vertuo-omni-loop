import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { JevKeyStatus } from '../store';
import { initialState, jevReducer, type JevAction } from './model';
import { JevScreen, NOT_AVAILABLE_TITLE, type JevScreenView } from './JevScreen';
import { ONLY_OWNER, SENDS, SWITCH_OFF, JevView } from './JevView';

// Settings › Jev as the server renders it (PRD 812 s1): the owner's view with and without a key, the
// key field, a refused test call, a member's view (no key field, no last four), and each situation of
// the page, all under the Settings tabs with Jev marked.

const NONE: JevKeyStatus = { stored: false, lastFour: null, setAt: null };
const STORED: JevKeyStatus = { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' };
const MEMBER_STORED: JevKeyStatus = { stored: true, lastFour: null, setAt: null };

const state = (key: JevKeyStatus, ...actions: JevAction[]) => actions.reduce(jevReducer, initialState(key));
const render = (key: JevKeyStatus, { owner = true, actions = [] as JevAction[] } = {}) =>
  renderToStaticMarkup(createElement(JevView, { state: state(key, ...actions), owner }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const buttons = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: text(m[2]) }));
const theSwitch = (html: string) => buttons(html).find((b) => b.attrs.includes('role="switch"'));
const inputs = (html: string) => [...html.matchAll(/<input\b([^>]*)\/?>/g)].map((m) => m[1]);

describe('the owner\'s view, with no key', () => {
  it('shows Jev off, and no key field until the switch is pressed', () => {
    const html = render(NONE);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Jev');
    expect(theSwitch(html)?.attrs).toContain('aria-checked="false"');
    expect(theSwitch(html)?.attrs).not.toContain('disabled');
    expect(text(html)).toContain('Off');
    expect(inputs(html)).toHaveLength(0);
    expect(text(html)).toContain('tested with one call, stored encrypted, and never shown again');
  });

  it('opens the key field, a password input, with what switching on sends, once the switch is pressed', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }] });
    const [input] = inputs(html);
    expect(input).toContain('type="password"');
    expect(input).toContain('name="key"');
    expect(input).toContain('autoComplete="off"');
    expect(text(html)).toContain(SENDS);
    expect(buttons(html).map((b) => b.text)).toEqual(['', 'Test and save', 'Cancel']);
  });

  it('keeps the field open and shows TypeSafe\'s reason when the test call is refused, and stores nothing', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }, { type: 'busy' }, { type: 'refused', message: 'TypeSafe refused this key: Invalid API key' }] });
    expect(/<p class="jev-refusal" role="alert">([^<]*)<\/p>/.exec(html)?.[1]).toBe('TypeSafe refused this key: Invalid API key');
    expect(inputs(html)).toHaveLength(1);
    expect(theSwitch(html)?.attrs).toContain('aria-checked="false"');
    expect(text(html)).not.toContain('••••');
  });

  it('waits while the test call is on its way', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }, { type: 'busy' }] });
    expect(buttons(html).find((b) => b.text === 'Testing…')?.attrs).toContain('disabled');
    expect(inputs(html)[0]).toContain('disabled');
  });
});

describe('the owner\'s view, with a key', () => {
  it('shows Jev on, the key\'s last four only, when it was saved, Replace key, and what switching off does', () => {
    const html = render(STORED);
    expect(theSwitch(html)?.attrs).toContain('aria-checked="true"');
    expect(text(html)).toContain('API key •••• 1a2b');
    expect(text(html)).toContain('saved 30 Sep 2026');
    expect(buttons(html).map((b) => b.text)).toContain('Replace key');
    expect(text(html)).toContain(SWITCH_OFF);
    expect(inputs(html)).toHaveLength(0);
  });

  it('shows the new last four once a key is saved', () => {
    const html = render(NONE, { actions: [{ type: 'edit' }, { type: 'busy' }, { type: 'saved', key: { ...STORED, lastFour: '9z9z' } }] });
    expect(text(html)).toContain('•••• 9z9z');
    expect(inputs(html)).toHaveLength(0);
  });

  it('is off again once the key is removed', () => {
    const html = render(STORED, { actions: [{ type: 'busy' }, { type: 'saved', key: NONE }] });
    expect(theSwitch(html)?.attrs).toContain('aria-checked="false"');
    expect(text(html)).not.toContain('••••');
  });
});

describe('a member\'s view', () => {
  it('shows whether Jev is on, and no key field, no last four, no control', () => {
    for (const key of [MEMBER_STORED, NONE]) {
      const html = render(key, { owner: false });
      expect(inputs(html)).toHaveLength(0);
      expect(text(html)).not.toContain('••••');
      expect(text(html)).toContain(ONLY_OWNER);
      expect(buttons(html).filter((b) => !b.attrs.includes('disabled'))).toEqual([]);
      expect(buttons(html).map((b) => b.text)).not.toContain('Replace key');
    }
    expect(text(render(MEMBER_STORED, { owner: false }))).toContain('Jev is on for this workspace.');
    expect(text(render(NONE, { owner: false }))).toContain('Jev is off for this workspace.');
  });

  it('never shows a last four even if one were handed to it', () => {
    expect(text(render(STORED, { owner: false }))).not.toContain('1a2b');
  });
});

describe('the page\'s situations', () => {
  const screen = (view: JevScreenView) => renderToStaticMarkup(createElement(JevScreen, { view }));
  const VIEWS: JevScreenView[] = [
    { kind: 'closed' }, { kind: 'sign-in' }, { kind: 'no-workspace' }, { kind: 'unreadable' }, { kind: 'unavailable' },
    { kind: 'jev', source: { kind: 'demo' }, owner: true, keyStatus: NONE },
  ];

  it('says what is wrong when there are no settings to show', () => {
    expect(text(screen({ kind: 'closed' }))).toContain('Jev is not open here');
    expect(text(screen({ kind: 'sign-in' }))).toContain('Sign in to see your Jev settings');
    expect(text(screen({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
    expect(text(screen({ kind: 'unreadable' }))).toContain('Couldn’t load your Jev settings');
  });

  it('says Jev is not available on this deployment without SECRETS_MASTER_KEY, with no key field', () => {
    const html = screen({ kind: 'unavailable' });
    expect(NOT_AVAILABLE_TITLE).toBe('Jev is not available on this deployment');
    expect(text(html)).toContain('Jev is not available on this deployment');
    expect(inputs(html)).toHaveLength(0);
    expect(html).not.toContain('role="switch"');
  });

  it('starts with the Fleets · Repositories · Business · Jev tabs in every situation, Jev marked', () => {
    for (const view of VIEWS) {
      const html = screen(view);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeGreaterThanOrEqual(0);
      expect(html.indexOf('class="section-tabs"'), view.kind).toBeLessThan(html.indexOf('<h1'));
      const tabs = [...html.matchAll(/<a [^>]*class="section-tab"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[0].includes('aria-current="page"')]);
      expect(tabs, view.kind).toEqual([['Fleets', false], ['Repositories', false], ['Business', false], ['Jev', true]]);
    }
  });
});

describe('the page\'s look', () => {
  it('keeps the key field within the window at 393 px', () => {
    const css = readFileSync(fileURLToPath(new URL('./jev.css', import.meta.url)), 'utf8');
    const at = css.indexOf('.jev-key-input {');
    expect(css.slice(at, css.indexOf('}', at))).toContain('max-width: 100%');
  });

  it('is imported by the route', () => {
    const page = readFileSync(fileURLToPath(new URL('../../../app/app/settings/jev/page.tsx', import.meta.url)), 'utf8');
    expect(page).toContain('src/jev/settings/jev.css');
  });
});
