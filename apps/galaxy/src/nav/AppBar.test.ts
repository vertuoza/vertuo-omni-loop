import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GAME_MODE } from '../switch/switch';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';

// The app's top bar (PRD 438) as the server renders it: the page's title on the left, then the theme
// switch (Omni, Light, Dark) and Game mode, unchanged, then, signed in, the bell (PRD 499), then you:
// the avatar signed in, Sign in with GitHub signed out.

const at = { path: '/ask/for-me' as string | null };
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));

const { AppBar } = await import('./AppBar.tsx');

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: null, workspaceName: 'Acme', waiting: null };

const render = (path: string | null, viewer: ViewerView = SIGNED_OUT_VIEWER) => {
  at.path = path;
  return renderToStaticMarkup(createElement(AppBar, { viewer }));
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').replace(/<div [^>]*role="menu"[\s\S]*?<\/div><\/div>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2]));

describe('the top bar', () => {
  it('is a header holding the page\'s title, then Omni/Light/Dark, then Game mode, then the avatar, in that order', () => {
    const bar = render('/ask/for-me', ADA);
    expect(bar).toMatch(/^<header class="app-bar">/);
    expect(bar).toContain('<p class="app-bar-title">Questions / Shared with me</p>');
    const title = bar.indexOf('app-bar-title'), theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(title).toBeGreaterThan(0);
    expect(theme).toBeGreaterThan(title);
    expect(game).toBeGreaterThan(theme);
    const avatar = bar.indexOf('aria-haspopup="menu"');
    expect(avatar).toBeGreaterThan(game);
    expect(controls(bar)).toEqual(['☰', '', 'Omni', 'Light', 'Dark', 'Game mode', '', 'A']);
  });

  it('holds, signed in, the bell between Game mode and the avatar, with the theme switch and Game mode', () => {
    const bar = render('/app', ADA);
    const bell = bar.indexOf('class="bell-button"');
    expect(bell).toBeGreaterThan(bar.indexOf('>Game mode'));
    expect(bell).toBeLessThan(bar.indexOf('aria-haspopup="menu"'));
    const view = bar.slice(bar.indexOf('<span class="app-bar-view">'), bar.indexOf('<span class="app-bar-you">'));
    expect(view).toContain('aria-label="Nothing waiting for you"');
  });

  it('holds no bell signed out', () => {
    expect(render('/app')).not.toContain('class="bell');
  });

  it('opens, for a phone, with ☰ ("Menu"), closed, which opens the sidebar, then the crest linked to /app', () => {
    const bar = render('/app', ADA);
    const [menu] = bar.match(/<button\b[^>]*class="app-bar-menu"[^>]*>/) ?? [''];
    expect(menu).toContain('aria-label="Menu"');
    expect(menu).toContain('aria-expanded="false"');
    expect(menu).toContain('aria-controls="app-sidebar"');
    expect(bar.indexOf('app-bar-menu')).toBeLessThan(bar.indexOf('app-bar-crest'));
    expect(bar.indexOf('app-bar-crest')).toBeLessThan(bar.indexOf('app-bar-title'));
    expect(bar).toMatch(/<a class="app-bar-crest" href="\/app" aria-label="OMNI LOOP, Home">/);
  });

  it('keeps the theme switch and Game mode together, the row that wraps on a phone, and you apart', () => {
    const bar = render('/app', ADA);
    const view = bar.slice(bar.indexOf('<span class="app-bar-view">'), bar.indexOf('<span class="app-bar-you">'));
    expect(view).toContain('aria-label="Theme"');
    expect(view).toContain('>Game mode');
    expect(view).not.toContain('aria-haspopup="menu"');
    expect(bar.slice(bar.indexOf('<span class="app-bar-you">'))).toContain('aria-haspopup="menu"');
  });

  it('ends, signed in, with the avatar button that opens the user menu', () => {
    const bar = render('/app', ADA);
    const last = [...bar.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]).filter((b) => !/role="menuitem"/.test(b)).pop() ?? '';
    expect(last).toContain('aria-haspopup="menu"');
    expect(last).toContain('aria-expanded="false"');
    expect(bar).not.toContain('Sign in with GitHub');
  });

  it('ends, signed out, with Sign in with GitHub in the avatar\'s place', () => {
    const bar = render('/app');
    expect(controls(bar)).toEqual(['☰', '', 'Omni', 'Light', 'Dark', 'Game mode', 'Sign in with GitHub']);
    expect(bar).not.toContain('aria-haspopup="menu"');
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

  it('below 900px shows ☰ and the crest, and above hides them', () => {
    expect(css).toMatch(/\.app-bar-menu,\s*\.app-bar-crest\s*\{\s*display:\s*none;?\s*\}/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*\.app-bar-menu/);
  });

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
