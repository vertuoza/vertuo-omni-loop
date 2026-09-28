import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GameModeButton } from './GameModeButton';
import { SECTIONS } from './switch';

// /app and the Game mode button as the server renders them: what a person sees before any script
// runs (PRD 238).

const { default: Page } = await import('../../app/app/page.tsx');
const { default: Layout, metadata } = await import('../../app/app/layout.tsx');

const app = renderToStaticMarkup(createElement(Layout, null, Page() as ReactElement));
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
  it('heads the page with OMNI LOOP · App, linked home, then the theme switch, then Game mode', () => {
    const bar = between(app, '<header class="ask-bar', '</header>');
    expect(bar).toMatch(/<a class="ask-mark[^"]*" href="\/app">OMNI LOOP<\/a>/);
    expect(bar).toContain('<span class="ask-brand-sub">App</span>');
    const theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(theme).toBeGreaterThan(0);
    expect(game).toBeGreaterThan(theme);
    // Game mode is the header's last control: after it, only its own dialog, closed.
    const [controls, after] = bar.split('<dialog');
    expect(controls.lastIndexOf('<button')).toBeLessThan(game);
    expect(after.slice(after.indexOf('</dialog>'))).not.toMatch(/<(button|a) /);
  });

  it('says what it is: a heading and one line', () => {
    expect(app).toMatch(/<h1[^>]*>Omni Loop<\/h1>/);
    expect(app).toContain('The loop’s questions and knowledge, as pages. The game is one tap away.');
  });

  it('lists every section as a link, in order, each with its line', () => {
    const cards = [...app.matchAll(/<a class="app-card" href="([^"]+)">([\s\S]*?)<\/a>/g)];
    expect(cards.map((m) => m[1])).toEqual(SECTIONS.map((s) => s.path));
    cards.forEach(([, , inner], i) => {
      expect(inner).toContain(SECTIONS[i].title);
      expect(inner).toContain(SECTIONS[i].line);
    });
  });

  it('reads the ask pages\' reading surface: the ask root, its theme script first', () => {
    expect(app).toMatch(/^<style>[\s\S]*--ask-ground[\s\S]*<\/style><div class="ask[^"]*"><script/);
  });

  it('is kept out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('reads nothing: no session, no cookie, no database', () => {
    for (const file of ['page.tsx', 'layout.tsx']) {
      const source = readFileSync(new URL(`../../app/app/${file}`, import.meta.url), 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      for (const path of imports) expect(path, `${file}: ${path}`).not.toMatch(/src\/(data|arcade)\/|supabase|next\/headers|live/);
      expect(source).not.toMatch(/\bawait\b|cookies\(|headers\(/);
    }
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

  it('lays the cards out one to a row on a phone, two from a wider screen', () => {
    const css = readFileSync(new URL('./home.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.app-cards \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).toMatch(/@media \(min-width: \d+px\) \{\s*\.app-cards \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  });
});
