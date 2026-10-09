import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { logoSvg, spritePixels } from '@omni/design';
import { describe, expect, it, vi } from 'vitest';
import { pixelSvg } from '../design/pixel-svg';
import { GAME_MODE } from '../switch/switch';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';
import { item } from '../ask/test/test-item';

// The app's top bar (PRD 438) as the server renders it: the section's sprite in its tile and the trail
// to the page (issue 704) on the left, then the theme switch (Omni, Light, Dark) and Game mode,
// unchanged, then, signed in, the bell (PRD 499), then you: the avatar signed in, Sign in with GitHub
// signed out.

const at = { path: '/ask/for-me' as string | null };
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));
// next/link as a plain anchor that records each href it links (PRD 657).
const linked = vi.hoisted((): string[] => []);
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return {
    default: (given: Record<string, unknown>) => {
      const props = { ...given };
      delete props.prefetch;
      linked.push(String(props.href));
      return h('a', props);
    },
  };
});

const { AppBar } = await import('./AppBar.tsx');

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: null, heroSvg: null, workspaceName: 'Acme', ideasBoard: null, waiting: null };

const render = (path: string | null, viewer: ViewerView = SIGNED_OUT_VIEWER) => {
  at.path = path;
  return renderToStaticMarkup(createElement(AppBar, { viewer }));
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** The bar's trail, the Breadcrumb nav. */
const trailOf = (bar: string) => bar.slice(bar.indexOf('<nav class="app-bar-trail"'), bar.indexOf('</nav>') + 6);
/** The markup of the bar's tile. */
const tileOf = (bar: string) => (bar.match(/<span class="app-bar-tile" aria-hidden="true">[\s\S]*?<\/svg><\/span>/) ?? [''])[0];
const tileWith = (svg: string) => `<span class="app-bar-tile" aria-hidden="true">${svg}</span>`;
const sprite = (name: string) => tileWith(pixelSvg(spritePixels(name), { scale: 2, title: '' }));
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').replace(/<div [^>]*role="menu"[\s\S]*?<\/div><\/div>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(item(m, 2)));

describe('the top bar', () => {
  it('is a header holding the trail to the page, then Omni/Light/Dark, then Game mode, then the avatar, in that order', () => {
    const bar = render('/ask/for-me', ADA);
    expect(bar).toMatch(/^<header class="app-bar">/);
    expect(text(trailOf(bar))).toBe('Work › Questions › Shared with me');
    const trail = bar.indexOf('app-bar-trail'), theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(trail).toBeGreaterThan(0);
    expect(theme).toBeGreaterThan(trail);
    expect(game).toBeGreaterThan(theme);
    const avatar = bar.indexOf('aria-haspopup="menu"');
    expect(avatar).toBeGreaterThan(game);
    expect(controls(bar)).toEqual(['☰', 'Questions', 'Omni', 'Light', 'Dark', 'Game mode', '', 'A']);
  });

  it('is a Breadcrumb list: the group as text, the section above the page a link, the page itself marked current (issue 704)', () => {
    expect(trailOf(render('/ask/for-me'))).toBe(
      '<nav class="app-bar-trail" aria-label="Breadcrumb"><ol>'
      + '<li>Work</li>'
      + '<li><span class="app-bar-sep" aria-hidden="true">›</span><a class="app-bar-up" href="/ask">Questions</a></li>'
      + '<li class="app-bar-here"><span class="app-bar-sep" aria-hidden="true">›</span><span aria-current="page">Shared with me</span></li>'
      + '</ol></nav>',
    );
  });

  it('links the section back from a page under it, marking nothing current there', () => {
    const trail = trailOf(render('/prd/3f2a'));
    expect(trail).toContain('<a class="app-bar-up" href="/prd">PRDs</a>');
    expect(trail).not.toContain('aria-current');
  });

  it('holds, signed in, the bell between Game mode and the avatar, with the theme switch and Game mode', () => {
    const bar = render('/app', ADA);
    const bell = bar.indexOf('class="bell-button"');
    expect(bell).toBeGreaterThan(bar.indexOf('>Game mode'));
    expect(bell).toBeLessThan(bar.indexOf('aria-haspopup="menu"'));
    const view = bar.slice(bar.indexOf('<span class="app-bar-view">'), bar.indexOf('<span class="app-bar-you">'));
    expect(view).toContain('aria-label="Nothing waiting for you"');
  });

  it('ends with the viewer\'s hero as the avatar button when they have one (PRD 652)', () => {
    const bar = render('/app', { ...ADA, heroSvg: '<svg viewBox="0 0 1 1"></svg>' });
    const you = bar.slice(bar.indexOf('<span class="app-bar-you">'));
    expect(you).toMatch(/aria-haspopup="menu"[^>]*><span class="user-menu-hero" aria-hidden="true"><svg viewBox="0 0 1 1"><\/svg><\/span><\/button>/);
    expect(controls(bar).at(-1)).toBe('');
  });

  it('holds no bell signed out', () => {
    expect(render('/app')).not.toContain('class="bell');
  });

  it('opens, for a phone, with ☰ ("Menu"), closed, which opens the sidebar, then the tile, then the trail', () => {
    const bar = render('/app', ADA);
    const [menu] = bar.match(/<button\b[^>]*class="app-bar-menu"[^>]*>/) ?? [''];
    expect(menu).toContain('aria-label="Menu"');
    expect(menu).toContain('aria-expanded="false"');
    expect(menu).toContain('aria-controls="app-sidebar"');
    expect(bar.indexOf('app-bar-menu')).toBeLessThan(bar.indexOf('app-bar-tile'));
    expect(bar.indexOf('app-bar-tile')).toBeLessThan(bar.indexOf('app-bar-trail'));
  });

  it('holds the section\'s own sprite at 2× in the tile where the crest was, the crest staying in the sidebar (issue 704)', () => {
    expect(tileOf(render('/app/workspace'))).toBe(sprite('menu-workspace'));
    expect(tileOf(render('/app'))).toBe(sprite('menu-home'));
    expect(tileOf(render('/prd/3f2a'))).toBe(sprite('menu-prds'));
    expect(tileOf(render('/concepts'))).toBe(sprite('menu-concepts'));
    expect(render('/app', ADA)).not.toContain('app-bar-crest');
  });

  it('holds a page\'s section sprite: Shared with me is under Questions, Fleets under Settings (PRD 733)', () => {
    expect(tileOf(render('/ask/for-me'))).toBe(sprite('menu-questions'));
    expect(tileOf(render('/app/settings/fleets'))).toBe(sprite('menu-settings'));
    expect(tileOf(render('/app/settings/repositories'))).toBe(sprite('menu-settings'));
    expect(tileOf(render('/app/settings/products/p-1'))).toBe(sprite('menu-settings'));
  });

  it('holds the OMNI LOOP mark in the tile on a path under no item', () => {
    const mark = tileWith(logoSvg('mark', { scale: 1, title: null }));
    expect(tileOf(render('/nowhere'))).toBe(mark);
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
    expect(controls(bar)).toEqual(['☰', 'Omni', 'Light', 'Dark', 'Game mode', 'Sign in with GitHub']);
    expect(bar).not.toContain('aria-haspopup="menu"');
  });

  it.each([
    ['/app', 'Dashboard › Home'],
    ['/app/fleet', 'Dashboard › Fleet'],
    ['/app/workspace', 'Dashboard › Workspace'],
    ['/app/settings/fleets', 'Settings › Fleets'],
    ['/app/settings/repositories', 'Settings › Repositories'],
    ['/app/settings/business', 'Settings › Business'],
    ['/app/settings/products', 'Settings › Products'],
    ['/app/settings/products/p-1', 'Settings › Products'],
    ['/app/settings/jev', 'Settings › Jev'],
    ['/ask/for-me', 'Work › Questions › Shared with me'],
    ['/prd/3f2a', 'Work › PRDs'],
    ['/ask/history', 'Work › Questions › History'],
    ['/knowledge', 'Work › Knowledge'],
  ])('on %s reads %s', (path, trail) => {
    expect(text(trailOf(render(path)))).toBe(trail);
  });

  it('shows no trail on a path that falls under no item', () => {
    expect(render('/nowhere')).not.toContain('app-bar-trail');
  });

  it('holds the Game mode dialog, closed, in exactly GAME_MODE\'s words', () => {
    const bar = render('/app');
    const dialog = bar.slice(bar.indexOf('<dialog'), bar.indexOf('</dialog>'));
    expect(bar).not.toMatch(/<dialog [^>]*\bopen\b/);
    expect(text(dialog)).toBe([GAME_MODE.title, GAME_MODE.line, GAME_MODE.stay, GAME_MODE.go].join(' '));
    expect(dialog).toMatch(/<a [^>]*href="\/#menu"[^>]*>Switch<\/a>/);
  });

  it('links back up the trail through next/link: a click keeps the layout (PRD 657)', () => {
    linked.length = 0;
    render('/prd/3f2a', ADA);
    expect(linked).toEqual(['/prd']);
    linked.length = 0;
    render('/ask/history', ADA);
    expect(linked).toEqual(['/ask']);
  });

  it('offers no System theme', () => {
    expect(controls(render('/app'))).not.toContain('System');
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./app-bar.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('below 900px shows ☰, and above hides it; the tile shows at every width', () => {
    expect(css).toMatch(/\.app-bar-menu\s*\{\s*display:\s*none;?\s*\}/);
    expect(css).toMatch(/@media \(max-width: 899\.98px\)[\s\S]*\.app-bar-menu/);
    expect(css).not.toMatch(/\.app-bar-tile[^{]*\{[^}]*display:\s*none/);
  });

  it('draws the sprite in the tile crisp, never smoothed', () => {
    expect(css).toMatch(/\.app-bar-tile svg\s*\{[^}]*image-rendering:\s*pixelated/);
  });

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
