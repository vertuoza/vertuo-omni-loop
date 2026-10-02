import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignInButton, UserMenu } from './UserMenu.tsx';
import type { ViewerView } from './viewer-view';
import { item } from '../ask/test-item';

// The end of the app's top bar (PRD 438) as the server renders it: signed in, the avatar button and
// its menu (the name and login, then Sign out); signed out, Sign in with GitHub.

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: 'https://avatars.test/ada.png', heroSvg: null, workspaceName: 'Acme', waiting: null };

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** What the menu reads: everything inside its element. */
const menuText = (html: string) => text(html.slice(html.indexOf('>', html.indexOf('role="menu"')) + 1));

describe('the user menu', () => {
  const html = renderToStaticMarkup(createElement(UserMenu, { viewer: ADA }));
  const button = html.match(/<button\b[^>]*>/)?.[0] ?? '';

  it('is an avatar button that says it opens a menu, closed at first', () => {
    expect(button).toContain('aria-haspopup="menu"');
    expect(button).toContain('aria-expanded="false"');
    expect(button).toMatch(/aria-controls="[^"]+"/);
    expect(button).toContain('aria-label="Your account, Ada Lovelace"');
    expect(html).toMatch(/<img [^>]*src="https:\/\/avatars.test\/ada.png"[^>]*alt=""/);
  });

  it('holds the name and login, then My profile, then Sign out, in that order', () => {
    expect(menuText(html)).toBe('Ada Lovelace @ada My profile Sign out');
    expect(html).toMatch(/<div [^>]*role="menu"[^>]*hidden=""/);
  });

  it('makes My profile and Sign out the only items that can be chosen: the name is a heading', () => {
    const items = [...html.matchAll(/role="menuitem"[^>]*>([\s\S]*?)<\/(?:a|button)>/g)].map((m) => text(item(m, 1)));
    expect(items).toEqual(['My profile', 'Sign out']);
    expect(html).toMatch(/role="presentation"[^>]*>[\s\S]*Ada Lovelace/);
  });

  it('shows the initial when the person has no picture', () => {
    const bare = renderToStaticMarkup(createElement(UserMenu, { viewer: { ...ADA, avatarUrl: null } }));
    expect(bare).not.toContain('<img');
    expect(bare).toContain('<span class="user-menu-initial" aria-hidden="true">A</span>');
  });

  it('shows the viewer\'s hero in place of the avatar when they have one, hidden from screen readers (PRD 652)', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="1" height="1" fill="#3355ff"/></svg>';
    const hero = renderToStaticMarkup(createElement(UserMenu, { viewer: { ...ADA, heroSvg: svg } }));
    const inside = hero.match(/<button\b[^>]*aria-haspopup="menu"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? '';
    expect(inside).toBe(`<span class="user-menu-hero" aria-hidden="true">${svg}</span>`);
    expect(hero).toContain('aria-label="Your account, Ada Lovelace"');
    expect(menuText(hero)).toBe('Ada Lovelace @ada My profile Sign out');
  });

  it('keeps the avatar, or the initial, when the viewer has no hero', () => {
    const inside = (v: ViewerView) => renderToStaticMarkup(createElement(UserMenu, { viewer: v })).match(/<button\b[^>]*aria-haspopup="menu"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? '';
    expect(inside(ADA)).toMatch(/^<img class="user-menu-avatar"/);
    expect(inside({ ...ADA, avatarUrl: null })).toBe('<span class="user-menu-initial" aria-hidden="true">A</span>');
  });

  it('leaves out a login it does not know, and My profile with it (PRD 698)', () => {
    const noLogin = renderToStaticMarkup(createElement(UserMenu, { viewer: { ...ADA, login: null } }));
    expect(menuText(noLogin)).toBe('Ada Lovelace Sign out');
    expect(noLogin).not.toContain('/app/people/');
  });

  it('makes My profile a link to the viewer\'s own profile, a menu item the arrow keys reach (PRD 698)', () => {
    const link = html.match(/<a\b[^>]*>My profile<\/a>/)?.[0] ?? '';
    expect(link).toContain('href="/app/people/ada"');
    expect(link).toContain('role="menuitem"');
    expect(link).toContain('tabindex="-1"');
    expect(link).toContain('class="user-menu-item"');
  });

  it('opens the profile of the login in lower case', () => {
    const upper = renderToStaticMarkup(createElement(UserMenu, { viewer: { ...ADA, login: 'Ada-L' } }));
    expect(upper).toContain('href="/app/people/ada-l"');
    expect(menuText(upper)).toBe('Ada Lovelace @Ada-L My profile Sign out');
  });

  it('signs out through signOutAndLeave, with the browser client', () => {
    const source = readFileSync(new URL('./UserMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain('signOutAndLeave(');
    expect(source).toContain('createBrowserClient<Database>(');
  });
});

describe('Sign in with GitHub', () => {
  it('is one button', () => {
    const html = renderToStaticMarkup(createElement(SignInButton));
    expect(text(html)).toBe('Sign in with GitHub');
    expect(html).toMatch(/^<button type="button" class="ask-button app-bar-sign-in"/);
  });

  it('starts the sign-in through signInFromBar, back through /app/callback', () => {
    const source = readFileSync(new URL('./UserMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain('signInFromBar(');
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./user-menu.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
