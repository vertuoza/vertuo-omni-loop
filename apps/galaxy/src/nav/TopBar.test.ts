import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MENU } from './menu';
import { TopBar } from './TopBar';

// The one header of the normal app (PRD 346): the OMNI LOOP mark to /app, the page's sub-title, the
// page's own extras, the menu (Release notes), the theme switch and Game mode, in that order. The
// item of the page being shown is marked current.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2]));

const render = (props: Parameters<typeof TopBar>[0]) => renderToStaticMarkup(createElement(TopBar, props));

describe('the menu', () => {
  it('holds Release notes, to /releases', () => {
    expect(MENU.map((m) => [m.id, m.label, m.path])).toEqual([['releases', 'Release notes', '/releases']]);
  });
});

describe('the top bar', () => {
  it('reads OMNI LOOP, linked to /app, then the sub-title', () => {
    const bar = render({ sub: 'App' });
    expect(bar).toMatch(/^<header class="ask-bar top-bar">/);
    expect(bar).toContain('<a class="ask-mark" href="/app">OMNI LOOP</a><span class="ask-brand-sub">App</span>');
  });

  it('offers OMNI LOOP, Release notes, the theme switch and Game mode, in that order', () => {
    expect(controls(render({ sub: 'App' }))).toEqual(['OMNI LOOP', 'Release notes', 'Omni', 'Light', 'Dark', 'Game mode']);
  });

  it('links Release notes to /releases, inside a navigation named Menu', () => {
    const bar = render({ sub: 'App' });
    expect(bar).toMatch(/<nav class="top-bar-menu" aria-label="Menu"><a class="top-bar-item" href="\/releases">Release notes<\/a><\/nav>/);
  });

  it('marks the current item with aria-current="page", and no other', () => {
    expect(render({ sub: 'Releases', current: 'releases' })).toContain('<a class="top-bar-item" href="/releases" aria-current="page">Release notes</a>');
    expect(render({ sub: 'App' })).not.toContain('aria-current');
  });

  it('puts the page\'s extras before the menu', () => {
    const bar = render({ sub: 'PRD dossier', extras: createElement('a', { className: 'ask-for-me-nav', href: '/prd' }, 'All PRDs') });
    expect(controls(bar)).toEqual(['OMNI LOOP', 'All PRDs', 'Release notes', 'Omni', 'Light', 'Dark', 'Game mode']);
  });

  it('puts what follows the sub-title inside the brand, and keeps a page\'s own classes', () => {
    const bar = render({
      sub: 'Knowledge map',
      brandExtra: createElement('code', { className: 'km-repo' }, 'acme/widgets'),
      classes: { bar: 'km-bar', brand: 'km-brand', end: 'km-bar-end' },
    });
    expect(bar).toMatch(/^<header class="ask-bar top-bar km-bar"><span class="ask-brand km-brand">/);
    expect(bar).toContain('<span class="ask-brand-sub">Knowledge map</span><code class="km-repo">acme/widgets</code></span>');
    expect(bar).toContain('<span class="ask-bar-end top-bar-end km-bar-end">');
  });

  it('holds the Game mode dialog, closed', () => {
    const bar = render({ sub: 'App' });
    expect(bar).toMatch(/<dialog [^>]*class="game-mode-dialog"/);
    expect(bar).not.toMatch(/<dialog [^>]*\bopen\b/);
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
});
