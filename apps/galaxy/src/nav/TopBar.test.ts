import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GAME_MODE } from '../switch/switch';
import { MENU } from './menu';
import { TopBar } from './TopBar';

// The public bar (PRD 346, reshaped by PRD 438), on /docs and /releases only: the OMNI LOOP mark to
// /app, the page's sub-title, the menu of Omni's own pages (Release notes, Docs: PRDs left it for the
// app's sidebar), Open the app → to /app, shown to everyone, then the theme switch and Game mode, last.
// The item of the page being shown is marked current.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2]!));

const render = (props: Parameters<typeof TopBar>[0]) => renderToStaticMarkup(createElement(TopBar, props));

describe('the menu', () => {
  it('holds Omni\'s pages only: Release notes, to /releases, then Docs, to /docs, and no PRDs', () => {
    expect(MENU.map((m) => [m.id, m.label, m.path])).toEqual([
      ['releases', 'Release notes', '/releases'],
      ['docs', 'Docs', '/docs'],
    ]);
  });
});

describe('the public bar', () => {
  it('reads OMNI LOOP, linked to /app, then the sub-title', () => {
    const bar = render({ sub: 'Docs' });
    expect(bar).toMatch(/^<header class="ask-bar top-bar">/);
    expect(bar).toContain('<a class="ask-mark" href="/app">OMNI LOOP</a><span class="ask-brand-sub">Docs</span>');
  });

  it('offers OMNI LOOP, Release notes, Docs, Open the app →, the theme switch and Game mode, in that order', () => {
    expect(controls(render({ sub: 'Docs' }))).toEqual(['OMNI LOOP', 'Release notes', 'Docs', 'Open the app →', 'Omni', 'Light', 'Dark', 'Game mode']);
  });

  it('links Release notes to /releases and Docs to /docs, inside a navigation named Menu, and PRDs nowhere', () => {
    const bar = render({ sub: 'Docs' });
    expect(bar).toMatch(/<nav class="top-bar-menu" aria-label="Menu"><a class="top-bar-item" href="\/releases">Release notes<\/a><a class="top-bar-item" href="\/docs">Docs<\/a><\/nav>/);
    expect(bar).not.toContain('href="/prd"');
    expect(text(bar)).not.toContain('PRDs');
  });

  it('links Open the app → to /app on every page, and never marks it current', () => {
    for (const current of [undefined, 'docs', 'releases'] as const) {
      expect(render({ sub: 'Docs', current })).toContain('<a class="top-bar-open" href="/app">Open the app →</a>');
    }
  });

  it('marks the current item with aria-current="page", and no other', () => {
    expect(render({ sub: 'Releases', current: 'releases' })).toContain('<a class="top-bar-item" href="/releases" aria-current="page">Release notes</a>');
    expect(render({ sub: 'Docs' })).not.toContain('aria-current');
  });

  it('marks Docs current on /docs, and Release notes not', () => {
    const bar = render({ sub: 'Docs', current: 'docs' });
    expect(bar).toContain('<a class="top-bar-item" href="/docs" aria-current="page">Docs</a>');
    expect(bar).toContain('<a class="top-bar-item" href="/releases">Release notes</a>');
    expect(bar.match(/aria-current/g)).toHaveLength(1);
  });

  it('holds the Game mode dialog, closed, in exactly GAME_MODE\'s words', () => {
    const bar = render({ sub: 'Docs' });
    const dialog = bar.slice(bar.indexOf('<dialog'), bar.indexOf('</dialog>'));
    expect(dialog).toMatch(/<dialog [^>]*class="game-mode-dialog"/);
    expect(bar).not.toMatch(/<dialog [^>]*\bopen\b/);
    expect(text(dialog)).toBe([GAME_MODE.title, GAME_MODE.line, GAME_MODE.stay, GAME_MODE.go].join(' '));
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./nav.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });

  it('wraps the bar\'s end on a phone, Game mode keeping the right end of its row', () => {
    expect(css).toMatch(/\.top-bar-end \{[^}]*flex-wrap: wrap;/);
    expect(css).toMatch(/\.top-bar-end > \.game-mode \{ margin-left: auto; \}/);
  });

  it('never breaks Open the app → across lines', () => {
    expect(css).toMatch(/\.ask a\.top-bar-open \{[^}]*white-space: nowrap;/);
  });
});
