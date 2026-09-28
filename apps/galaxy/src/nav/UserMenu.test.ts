import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignInButton, UserMenu } from './UserMenu.tsx';
import type { ViewerView } from './viewer-view';

// The end of the app's top bar (PRD 438) as the server renders it: signed in, the avatar button and
// its menu (the name and login, then Sign out); signed out, Sign in with GitHub.

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: 'https://avatars.test/ada.png', workspaceName: 'Acme', forMe: 3 };

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

  it('holds the name and login, then Sign out, in that order', () => {
    expect(menuText(html)).toBe('Ada Lovelace @ada Sign out');
    expect(html).toMatch(/<div [^>]*role="menu"[^>]*hidden=""/);
  });

  it('makes Sign out the only item that can be chosen: the name is a heading', () => {
    const items = [...html.matchAll(/role="menuitem"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]));
    expect(items).toEqual(['Sign out']);
    expect(html).toMatch(/role="presentation"[^>]*>[\s\S]*Ada Lovelace/);
  });

  it('shows the initial when the person has no picture', () => {
    const bare = renderToStaticMarkup(createElement(UserMenu, { viewer: { ...ADA, avatarUrl: null } }));
    expect(bare).not.toContain('<img');
    expect(bare).toContain('<span class="user-menu-initial" aria-hidden="true">A</span>');
  });

  it('leaves out a login it does not know', () => {
    const noLogin = renderToStaticMarkup(createElement(UserMenu, { viewer: { ...ADA, login: null } }));
    expect(menuText(noLogin)).toBe('Ada Lovelace Sign out');
  });

  it('signs out through signOutAndLeave, with the browser client', () => {
    const source = readFileSync(new URL('./UserMenu.tsx', import.meta.url), 'utf8');
    expect(source).toContain('signOutAndLeave(');
    expect(source).toContain('createBrowserClient(');
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
