import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GameModeButton } from './GameModeButton';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/app' }));

// /app and the Game mode button as the server renders them: what a person sees before any script
// runs (PRD 238). /app is your dashboard (PRD 328), inside the app shell (PRD 438): here in the demo,
// as development serves it without a database; its every situation is src/dashboard/render.test.ts's.

const { default: Page } = await import('../../app/app/page.tsx');
const { default: Layout, metadata } = await import('../../app/app/layout.tsx');

const page = (await Page({ searchParams: Promise.resolve({}) })) as ReactElement;
const app = renderToStaticMarkup((await Layout({ children: page })) as ReactElement);
const button = renderToStaticMarkup(createElement(GameModeButton));

/** The part of the markup from one marker to the next. */
const between = (html: string, start: string, end: string) => {
  const from = html.indexOf(start);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = html.indexOf(end, from + start.length);
  return html.slice(from, to < 0 ? undefined : to + end.length);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the Game mode button', () => {
  it('is a button named Game mode, its glyph hidden from a screen reader', () => {
    const own = between(button, '<button', '</button>');
    expect(own).toMatch(/^<button type="button"[^>]*aria-haspopup="dialog"/);
    expect(text(own)).toBe('Game mode');
    expect(own).toMatch(/<svg [^>]*aria-hidden="true"/);
  });

  it('opens a dialog, closed until pressed, titled Switch to game mode?', () => {
    const dialog = between(button, '<dialog', '</dialog>');
    expect(dialog).not.toMatch(/^<dialog[^>]* open/);
    const labelled = /^<dialog[^>]*aria-labelledby="([^"]+)"/.exec(dialog)?.[1];
    expect(labelled).toBeTruthy();
    expect(dialog).toMatch(new RegExp(`<h2 id="${labelled}"[^>]*>Switch to game mode\\?</h2>`));
    expect(dialog).toContain('The arcade opens on its menu.');
  });

  it('offers Stay, then Switch, which leads to the arcade\'s menu', () => {
    const dialog = between(button, '<dialog', '</dialog>');
    expect(dialog).toMatch(/<button type="button"[^>]*>Stay<\/button>/);
    expect(dialog).toMatch(/<a [^>]*href="\/#menu"[^>]*>Switch<\/a>/);
    expect(dialog.indexOf('>Stay<')).toBeLessThan(dialog.indexOf('>Switch<'));
  });
});

describe('/app', () => {
  it('sits in the app shell: the sidebar, Home marked current, then the top bar titled Home, the theme switch and Game mode', () => {
    const side = between(app, '<aside class="app-sidebar"', '</aside>');
    expect(side).toMatch(/<a class="app-sidebar-crest" href="\/app">/);
    // next/link (PRD 657) writes aria-current before href: read each link whatever its attributes' order.
    const marked = [...side.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).filter((a) => a.includes('aria-current="page"'));
    expect(marked.map((a) => /href="([^"]+)"/.exec(a)?.[1])).toEqual(['/app']);
    const bar = between(app, '<header class="app-bar"', '</header>');
    expect(bar).toContain('<p class="app-bar-title">Home</p>');
    const theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(theme).toBeGreaterThan(0);
    expect(game).toBeGreaterThan(theme);
    expect(app.indexOf('</aside>')).toBeLessThan(app.indexOf('<header class="app-bar"'));
    expect(app.indexOf('</header>')).toBeLessThan(app.indexOf('<main class="ask-main">'));
    expect(app).not.toContain('top-bar');
  });

  it('is your dashboard: headed by your name, the page\'s one h1 (the demo\'s DAM-DEV), beside your hero', () => {
    expect([...app.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1])).toEqual(['DAM-DEV']);
    expect(app).toMatch(/<svg [^>]*role="img"[^>]*aria-label="DAM-DEV’s hero"/);
    expect(app).not.toContain('The loop’s questions and knowledge, as pages.');
  });

  it('draws no section cards: the sidebar leads to every section (PRD 438)', () => {
    expect(app).not.toContain('dash-card');
    const main = between(app, '<main', '</main>');
    // The board's period switch (PRD 572) is the one navigation Home's page holds.
    expect(main.match(/<nav\b[^>]*>/g)).toEqual(['<nav class="board-period" aria-label="Period">']);
  });

  it('reads the ask pages\' reading surface: the ask root, its theme script first', () => {
    expect(app).toMatch(/^<style>[\s\S]*--ask-ground[\s\S]*<\/style><div class="ask app-shell"><script/);
  });

  it('is kept out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps its layout reading only the viewer, through the app shell: no database of its own', () => {
    const source = readFileSync(new URL('../../app/app/layout.tsx', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    for (const path of imports) expect(path, `layout.tsx: ${path}`).not.toMatch(/src\/(data|arcade)\/|supabase|next\/headers|live/);
    expect(source).toMatch(/<AppShell viewer=\{await viewerLive\(\)\}>/);
    expect(source).not.toMatch(/cookies\(|headers\(/);
  });

  it('renders per request, as the signed-in person: the page reads the address, then the session', () => {
    const source = readFileSync(new URL('../../app/app/page.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/export default async function/);
    expect(source).toMatch(/await searchParams/);
    expect(source).toMatch(/\bviewer\(\)/);
    expect(source).not.toMatch(/export const dynamic|generateStaticParams/);
  });
});

describe('the stylesheets', () => {
  for (const file of ['switch.css', 'home.css']) {
    const css = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    it(`${file} names no colour of its own: every colour comes from the ask pages' tokens`, () => {
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
      expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
    });
  }

  it('dims the page behind the Game mode dialog with the ground\'s colour on Omni, as on dark', () => {
    const css = readFileSync(new URL('./switch.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const onGround = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[2].includes('background: var(--ask-ground);'))
      .flatMap((m) => m[1].split(',').map((one) => one.trim()));
    for (const theme of ['omni', 'dark']) expect(onGround, theme).toContain(`.ask[data-ask-theme='${theme}'] .game-mode-dialog::backdrop`);
    expect(onGround.join()).not.toContain("data-ask-theme='light'");
  });

  it('keeps nothing of /app in home.css: its bar went to nav.css (PRD 346), its cards to the dashboard (PRD 328)', () => {
    const css = readFileSync(new URL('./home.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.trim()).toBe('');
    expect(css).not.toMatch(/\.app-(card|cards|intro|heading|line|home)\b/);
  });
});
