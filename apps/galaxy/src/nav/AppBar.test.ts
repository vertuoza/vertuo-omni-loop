import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GAME_MODE } from '../switch/switch';
import { SIGNED_OUT_VIEWER } from './viewer-view';

// The app's top bar (PRD 438) as the server renders it: the page's title on the left, then the theme
// switch (Omni, Light, Dark) and Game mode, unchanged.

const at = { path: '/ask/for-me' as string | null };
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));

const { AppBar } = await import('./AppBar.tsx');

const render = (path: string | null) => {
  at.path = path;
  return renderToStaticMarkup(createElement(AppBar, { viewer: SIGNED_OUT_VIEWER }));
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2]));

describe('the top bar', () => {
  it('is a header holding the page\'s title, then Omni/Light/Dark, then Game mode, in that order', () => {
    const bar = render('/ask/for-me');
    expect(bar).toMatch(/^<header class="app-bar">/);
    expect(bar).toContain('<p class="app-bar-title">Questions / For me</p>');
    const title = bar.indexOf('app-bar-title'), theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(title).toBeGreaterThan(0);
    expect(theme).toBeGreaterThan(title);
    expect(game).toBeGreaterThan(theme);
    expect(controls(bar)).toEqual(['Omni', 'Light', 'Dark', 'Game mode']);
  });

  it.each([
    ['/app', 'Home'],
    ['/app/fleets', 'Fleets'],
    ['/prd/3f2a', 'PRDs'],
    ['/ask/history', 'Questions / History'],
    ['/knowledge', 'Knowledge'],
  ])('on %s reads %s', (path, title) => {
    expect(render(path)).toContain(`<p class="app-bar-title">${title}</p>`);
  });

  it('shows no title on a path that falls under no item', () => {
    expect(render('/nowhere')).not.toContain('app-bar-title');
  });

  it('holds the Game mode dialog, closed, in exactly GAME_MODE\'s words', () => {
    const bar = render('/app');
    const dialog = bar.slice(bar.indexOf('<dialog'), bar.indexOf('</dialog>'));
    expect(bar).not.toMatch(/<dialog [^>]*\bopen\b/);
    expect(text(dialog)).toBe([GAME_MODE.title, GAME_MODE.line, GAME_MODE.stay, GAME_MODE.go].join(' '));
    expect(dialog).toMatch(/<a [^>]*href="\/#menu"[^>]*>Switch<\/a>/);
  });

  it('offers no System theme', () => {
    expect(controls(render('/app'))).not.toContain('System');
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./app-bar.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
