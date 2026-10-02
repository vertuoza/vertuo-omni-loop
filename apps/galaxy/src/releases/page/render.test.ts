import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_RELEASES } from '../demo';
import { RELEASES } from '../words';
import { ReleasesPage } from './ReleasesPage';

// /releases as the server renders it (PRD 262), from the demo sample: what a visitor and a search
// engine read, with no script run. The tests run in the demo's mode (no Supabase, not production).

const { default: Page, revalidate } = await import('../../../app/releases/page.tsx');
const { default: Layout, metadata } = await import('../../../app/releases/layout.tsx');

const html = renderToStaticMarkup(createElement(Layout, null, (await Page()) as ReactElement));
const alone = (view: Parameters<typeof ReleasesPage>[0]['view']) => renderToStaticMarkup(createElement(ReleasesPage, { view }));

/** The part of the markup from one marker to the next. */
const between = (markup: string, start: string, end: string) => {
  const from = markup.indexOf(start);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = markup.indexOf(end, from + start.length);
  return markup.slice(from, to < 0 ? undefined : to + end.length);
};
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = (markup: string) => decode(markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
/** Each release's own markup, by its anchor. */
const release = (version: string) => between(html, `<article id="${version}"`, '</article>');

describe('the app bar', () => {
  it('reads OMNI LOOP · Releases, linked to the app\'s home, then the theme switch, then Game mode', () => {
    const bar = between(html, '<header class="ask-bar', '</header>');
    expect(bar).toMatch(/<a class="brand-logo" href="\/app">[\s\S]*?<span class="ask-mark">OMNI LOOP<\/span><\/a>/);
    expect(bar).toContain('<span class="ask-brand-sub">Releases</span>');
    const theme = bar.indexOf('aria-label="Theme"'), game = bar.indexOf('>Game mode');
    expect(theme).toBeGreaterThan(0);
    expect(game).toBeGreaterThan(theme);
  });

  it('stands on the ask pages\' reading surface: their tokens, their root, their theme script first', () => {
    expect(html).toMatch(/^<style>[\s\S]*--ask-ground[\s\S]*<\/style><div class="ask[^"]*"><script/);
  });
});

describe('the page', () => {
  it('says what it is: a heading and its line', () => {
    expect(html).toMatch(/<h1[^>]*>What’s new in Omni Loop<\/h1>/);
    expect(html).toContain('Every PRD the loop ships, in plain words. Newest first.');
  });

  it('heads each week Week of its Monday, newest first', () => {
    const weeks = [...html.matchAll(/Week of (\d+ \w+ \d{4})/g)].map((m) => m[1]);
    expect(weeks).toEqual(['19 Oct 2026', '12 Oct 2026', '5 Oct 2026', '28 Sep 2026', '21 Sep 2026']);
  });

  it('lists the releases newest first, each under its anchor, its version', () => {
    const anchors = [...html.matchAll(/<article id="([^"]+)"/g)].map((m) => m[1]);
    expect(anchors).toEqual(['0.0.7', '0.0.6', '0.0.5', '0.0.4', '0.0.3', '0.0.2', '0.0.1']);
  });

  it('shows each release\'s version, as a link to itself, its day, PRD <n> as plain text, its title as a heading, and its description', () => {
    const own = release('0.0.3');
    expect(own).toMatch(/<a class="rel-version" href="#0\.0\.3"[^>]*>0\.0\.3<\/a>/);
    expect(own).toMatch(/<time dateTime="2026-09-29">Tue 29 Sep<\/time>/);
    expect(own).toMatch(/<h3 class="rel-title">Answer from your phone between two meetings<\/h3>/);
    expect(text(own)).toContain('PRD 270');
    expect(text(own)).toContain('Ask mode\'s page fits a phone screen');
    // The only link of a release is its own anchor: never the PRD.
    expect([...own.matchAll(/<a /g)]).toHaveLength(1);
  });

  it('reads as words once the markup is stripped, as a search engine and a screen reader take it', () => {
    const stripped = (markup: string) => decode(markup.replace(/<[^>]+>/g, ''));
    expect(stripped(release('0.0.3'))).toMatch(/^0\.0\.3 · Tue 29 Sep · PRD 270Answer/);
    expect(stripped(between(html, '<h2 class="rel-week-head"', '</h2>'))).toBe('Week of 19 Oct 2026 · 2 releases · 2 PRDs');
    expect(stripped(between(html, '<summary', '</summary>'))).toBe('Week of 21 Sep 2026 · 1 release · 21 PRDs');
  });

  it('shows release 0.0.1 as the initial release: its headline, its intro, then one line per PRD in PRD order', () => {
    const initial = release('0.0.1');
    expect(text(initial)).toMatch(/^0\.0\.1 · Sun 27 Sep · Initial release/);
    expect(initial).toMatch(/<h3 class="rel-title">From idea to merged PR, on a loop\.<\/h3>/);
    expect(text(initial)).toContain(RELEASES.initial.intro);
    const lines = [...initial.matchAll(/<li class="rel-line">([\s\S]*?)<\/li>/g)].map((m) => text(m[1]!));
    const rows = DEMO_RELEASES.filter((r) => r.release === 1).sort((a, b) => a.prd - b.prd);
    expect(lines).toEqual(rows.map((r) => `${r.title} ${r.description} PRD ${r.prd}`));
    expect(lines).toHaveLength(21);
  });

  it('keeps the four newest weeks open and folds the older ones into a closed <details>, its summary counting releases and PRDs', () => {
    const folds = [...html.matchAll(/<details class="rel-week rel-fold"( open="")?>\s*<summary[^>]*>([\s\S]*?)<\/summary>/g)];
    expect(folds.map((m) => [Boolean(m[1]), text(m[2]!)])).toEqual([[false, 'Week of 21 Sep 2026 · 1 release · 21 PRDs']]);
    expect(between(html, '<details', '</details>')).toContain('<article id="0.0.1"');
    expect([...html.matchAll(/<section class="rel-week"/g)]).toHaveLength(4);
  });

  it('holds no link to GitHub, no noindex, and no script beyond the theme\'s', () => {
    expect(html).not.toMatch(/github\.com/i);
    expect(html).not.toMatch(/noindex/i);
    expect([...html.matchAll(/<script/g)]).toHaveLength(1);
  });
});

describe('when there is nothing to show', () => {
  it('says the releases are unavailable, closed or when a read failed, with no error detail', () => {
    const page = alone({ kind: 'unavailable' });
    expect(page).toMatch(/<h1[^>]*>What’s new in Omni Loop<\/h1>/);
    expect(text(page)).toContain('Release notes are unavailable right now.');
    expect(page).not.toMatch(/Week of|<article|error|Supabase/i);
  });

  it('says no release is published yet while the table is empty', () => {
    const page = alone({ kind: 'releases', rows: [] });
    expect(text(page)).toContain('No release is published yet.');
    expect(page).not.toMatch(/Week of|<article/);
  });
});

describe('its metadata', () => {
  it('names it for the tab, search engines and link previews: title, description, canonical address, Open Graph', () => {
    expect(metadata.title).toBe('Release notes · Omni Loop');
    expect(metadata.description).toBe(RELEASES.description);
    expect(metadata.alternates?.canonical).toBe('https://vertuo-omni-loop-galaxy.vercel.app/releases');
    expect(metadata.openGraph).toMatchObject({
      type: 'website',
      url: 'https://vertuo-omni-loop-galaxy.vercel.app/releases',
      siteName: 'Omni Loop',
      title: 'Release notes · Omni Loop',
      description: RELEASES.description,
    });
  });

  it('lets search engines index it: no robots rule of its own', () => {
    expect(metadata.robots).toBeUndefined();
  });

  it('regenerates the page at most every five minutes', () => {
    expect(revalidate).toBe(300);
  });
});

describe('what it reads', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const sources = [
    ...readdirSync(join(ROOT, 'app/releases')).map((f) => join(ROOT, 'app/releases', f)),
    ...readdirSync(join(ROOT, 'src/releases/page')).filter((f) => !f.endsWith('.test.ts')).map((f) => join(ROOT, 'src/releases/page', f)),
    ...['store.ts', 'weeks.ts', 'words.ts', 'demo.ts'].map((f) => join(ROOT, 'src/releases', f)),
  ];

  it('imports no sign-in helper and reads no cookie: anyone reads it, as nobody', () => {
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      for (const path of imports) expect(path, `${file}: ${path}`).not.toMatch(/supabase-server|sign-in|signin|@supabase\/ssr|next\/headers|\/auth|workspace/);
      expect(source, file).not.toMatch(/cookies\(|headers\(|getUser|getSession/);
    }
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./releases.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });

  it('leaves the pixel face to the wordmark', () => {
    expect(css).not.toMatch(/--ask-px|Press Start 2P|Jersey 10/);
  });

  it('draws the folded weeks\' marker itself, the browser\'s own hidden', () => {
    expect(css).toMatch(/\.rel-fold > summary \{[^}]*list-style: none;/);
    expect(css).toMatch(/\.rel-fold > summary::-webkit-details-marker \{ display: none; \}/);
  });
});
