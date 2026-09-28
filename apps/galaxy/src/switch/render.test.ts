import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GameModeButton } from './GameModeButton';
import { SECTIONS } from './switch';

vi.mock('server-only', () => ({}));

// /app and the Game mode button as the server renders them: what a person sees before any script
// runs (PRD 238). /app is your dashboard (PRD 328): here in the demo, as development serves it
// without a database; its every situation is src/dashboard/render.test.ts's.

const { default: Page } = await import('../../app/app/page.tsx');
const { default: Layout, metadata } = await import('../../app/app/layout.tsx');

const page = (await Page({ searchParams: Promise.resolve({}) })) as ReactElement;
const app = renderToStaticMarkup(createElement(Layout, null, page));
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
  it('heads the page with OMNI LOOP · App, linked home, then Release notes, the theme switch and Game mode', () => {
    const bar = between(app, '<header class="ask-bar', '</header>');
    expect(bar).toMatch(/<a class="ask-mark[^"]*" href="\/app">OMNI LOOP<\/a>/);
    expect(bar).toContain('<span class="ask-brand-sub">App</span>');
    expect(bar).toContain('<a class="top-bar-item" href="/releases">Release notes</a>');
    const theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(theme).toBeGreaterThan(0);
    expect(game).toBeGreaterThan(theme);
    // Game mode is the header's last control: after it, only its own dialog, closed.
    const [controls, after] = bar.split('<dialog');
    expect(controls.lastIndexOf('<button')).toBeLessThan(game);
    expect(after.slice(after.indexOf('</dialog>'))).not.toMatch(/<(button|a) /);
  });

  it('is your dashboard: headed by your name, the page\'s one h1 (the demo\'s DAM-DEV), beside your hero', () => {
    expect([...app.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1])).toEqual(['DAM-DEV']);
    expect(app).toMatch(/<svg [^>]*role="img"[^>]*aria-label="DAM-DEV’s hero"/);
    expect(app).not.toContain('The loop’s questions and knowledge, as pages.');
  });

  it('ends with four sections: Questions, For me, History and Knowledge map, none of them Release notes', () => {
    const cards = [...app.matchAll(/<a class="dash-card" href="([^"]+)">/g)].map((m) => m[1]);
    expect(cards).toEqual(['/ask', '/ask/for-me', '/ask/history', '/knowledge']);
  });

  it('ends with every section as a compact link, in order: its title, without its line or path', () => {
    const cards = [...app.matchAll(/<a class="dash-card" href="([^"]+)">([\s\S]*?)<\/a>/g)];
    expect(cards.map((m) => [m[1], m[2]])).toEqual(SECTIONS.map((s) => [s.path, s.title]));
    for (const s of SECTIONS) expect(app).not.toContain(s.line);
    const main = between(app, '<main', '</main>');
    expect(main.slice(main.indexOf('</nav>'))).not.toMatch(/<(a|p|section|h\d)\b/);
  });

  it('reads the ask pages\' reading surface: the ask root, its theme script first', () => {
    expect(app).toMatch(/^<style>[\s\S]*--ask-ground[\s\S]*<\/style><div class="ask[^"]*"><script/);
  });

  it('is kept out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('keeps its layout reading nothing: no session, no cookie, no database', () => {
    const source = readFileSync(new URL('../../app/app/layout.tsx', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    for (const path of imports) expect(path, `layout.tsx: ${path}`).not.toMatch(/src\/(data|arcade)\/|supabase|next\/headers|live/);
    expect(source).not.toMatch(/\bawait\b|cookies\(|headers\(/);
  });

  it('renders per request, as the signed-in person: the page reads the address, then the session', () => {
    const source = readFileSync(new URL('../../app/app/page.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/export default async function/);
    expect(source).toMatch(/await searchParams/);
    expect(source).toMatch(/supabaseServer\(\)/);
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

  it('keeps nothing of /app in home.css: the bar is the top bar\'s (PRD 346), the cards went with the menu (PRD 328)', () => {
    const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const home = strip(readFileSync(new URL('./home.css', import.meta.url), 'utf8'));
    expect(home.trim()).toBe('');
    const nav = strip(readFileSync(new URL('../nav/nav.css', import.meta.url), 'utf8'));
    expect(nav).toMatch(/\.top-bar-end \{[^}]*flex-wrap: wrap;/);
  });
});
