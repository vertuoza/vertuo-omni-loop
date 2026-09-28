import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AskBar } from '../ask/page/AskBar';
import { ForMeLink } from '../ask/page/ForMe';
import { HistoryLink } from '../ask/page/WorkspaceHistory';
import { GRAPH } from '../knowledge/fixture';
import { KnowledgeScreen } from '../knowledge/KnowledgeScreen';
import { APP_HOME } from './switch';

// Every header of the app, as the server renders it (PRD 238): its OMNI LOOP mark leads home to
// /app, and Game mode is its last control, right after the theme switch, at the top right. /app's own
// header, /releases' (PRD 262), /prd's, the /ask pages' (AskBar, which app/ask/layout.tsx renders)
// and the /knowledge bar, and /docs'. Since PRD 346 they are all one: TopBar (src/nav/), with the
// menu's PRDs (PRD 413), Release notes and Docs, the one of the page being shown marked current. The /knowledge bar in each of the page's states is
// src/knowledge/render.test.ts's.

const { default: AppLayout } = await import('../../app/app/layout.tsx');
const { default: ReleasesLayout } = await import('../../app/releases/layout.tsx');
const { default: DossierLayout } = await import('../../app/prd/layout.tsx');
const { default: DocsLayout } = await import('../../app/docs/layout.tsx');

/** The header in the markup, its Game mode dialog included. */
const header = (html: string) => {
  const from = html.indexOf('<header');
  expect(from, '<header').toBeGreaterThanOrEqual(0);
  return html.slice(from, html.indexOf('</header>', from) + '</header>'.length);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** What a person can press in a header, in order, by name: its links and buttons, the Game mode
 * dialog's own left out (it is closed until Game mode opens it). */
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2]));

/** The theme switch, Omni first (PRD 284), then Game mode. */
const THEME_THEN_GAME = ['Omni', 'Light', 'Dark', 'Game mode'];
/** The menu (PRD 346, PRDs first since PRD 413), then the theme switch and Game mode. */
const MENU_THEN_THEME = ['PRDs', 'Release notes', 'Docs', ...THEME_THEN_GAME];

const askBar = (waiting = 0) =>
  header(renderToStaticMarkup(createElement(AskBar, null, createElement(HistoryLink), createElement(ForMeLink, { count: waiting }))));

const HEADERS: Array<[string, () => string]> = [
  ['/app', () => header(renderToStaticMarkup(createElement(AppLayout, null, createElement('p')) as ReactElement))],
  ['/releases', () => header(renderToStaticMarkup(createElement(ReleasesLayout, null, createElement('p')) as ReactElement))],
  ['/prd', () => header(renderToStaticMarkup(createElement(DossierLayout, null, createElement('p')) as ReactElement))],
  ['every /ask page', () => askBar()],
  ['/knowledge', () => header(renderToStaticMarkup(createElement(KnowledgeScreen, {
    view: { kind: 'map', graph: GRAPH }, wanted: { domain: null, entry: null }, supabase: null, signinError: null,
  })))],
  ['/docs', () => header(renderToStaticMarkup(createElement(DocsLayout, null, createElement('p')) as ReactElement))],
];

/** The page whose menu item each header marks current, if any. */
const CURRENT: Record<string, string> = { '/prd': '/prd', '/releases': '/releases', '/docs': '/docs' };

describe('every header of the app', () => {
  it.each(HEADERS)('%s: the OMNI LOOP mark is a link to /app', (_, bar) => {
    expect(bar()).toMatch(new RegExp(`<a class="ask-mark" href="${APP_HOME}">OMNI LOOP</a>`));
  });

  it.each(HEADERS)('%s: ends with Game mode, right after the theme switch', (_, bar) => {
    expect(controls(bar()).slice(-4)).toEqual(THEME_THEN_GAME);
  });

  it.each(HEADERS)('%s: is the shared top bar, with PRDs, Release notes and Docs right before the theme switch', (_, bar) => {
    expect(bar()).toMatch(/^<header class="ask-bar top-bar[" ]/);
    expect(controls(bar()).slice(-7)).toEqual(MENU_THEN_THEME);
    expect(bar()).toMatch(/<a class="top-bar-item" href="\/prd"( aria-current="page")?>PRDs<\/a>/);
    expect(bar()).toMatch(/<a class="top-bar-item" href="\/releases"( aria-current="page")?>Release notes<\/a>/);
    expect(bar()).toMatch(/<a class="top-bar-item" href="\/docs"( aria-current="page")?>Docs<\/a>/);
  });

  it.each(HEADERS)('%s: marks PRDs current on /prd only, Release notes on /releases only, and Docs on /docs only', (name, bar) => {
    const current = [...bar().matchAll(/<a [^>]*href="([^"]+)" aria-current="page"/g)].map((m) => m[1]);
    expect(current).toEqual(CURRENT[name] ? [CURRENT[name]] : []);
  });

  it.each(HEADERS)('%s: offers no System theme', (_, bar) => {
    expect(controls(bar())).not.toContain('System');
    expect(bar()).not.toContain('data-choice="system"');
  });

  it.each(HEADERS)('%s: holds the Game mode dialog, closed', (_, bar) => {
    expect(bar()).toMatch(/<dialog [^>]*class="game-mode-dialog"/);
    expect(bar()).not.toMatch(/<dialog [^>]*\bopen\b/);
  });
});

describe('the layouts', () => {
  it.each(['app/app/layout.tsx', 'app/releases/layout.tsx', 'app/prd/layout.tsx', 'app/ask/layout.tsx', 'app/docs/layout.tsx', 'src/ask/page/AskBar.tsx', 'src/knowledge/KnowledgeScreen.tsx'])(
    '%s copies no header of its own: it renders TopBar',
    (file) => {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
      expect(source).not.toContain('<header');
      expect(source).toMatch(/<(TopBar|AskBar)\b/);
    },
  );
});

describe('/prd\'s header', () => {
  it('reads OMNI LOOP · PRD dossier, then the menu, PRDs marked current: no All PRDs extra (PRD 413)', () => {
    const bar = header(renderToStaticMarkup(createElement(DossierLayout, null, createElement('p')) as ReactElement));
    expect(bar).toContain('<span class="ask-brand-sub">PRD dossier</span>');
    expect(bar).toContain('<a class="top-bar-item" href="/prd" aria-current="page">PRDs</a>');
    expect(bar).not.toContain('All PRDs');
    expect(controls(bar)).toEqual(['OMNI LOOP', ...MENU_THEN_THEME]);
  });
});

describe('the /ask header', () => {
  it('reads OMNI LOOP · Claude asks, then History, For me, Release notes, the theme switch and Game mode, in that order', () => {
    const bar = askBar();
    expect(bar).toContain('<span class="ask-brand-sub">Claude asks</span>');
    expect(controls(bar)).toEqual(['OMNI LOOP', 'History', 'For me', ...MENU_THEN_THEME]);
  });

  it('keeps For me\'s count of the questions waiting', () => {
    const bar = askBar(2);
    expect(bar).toMatch(/<a [^>]*href="\/ask\/for-me" aria-label="For me: 2 waiting">For me<span class="ask-count">2<\/span><\/a>/);
    expect(controls(bar)).toEqual(['OMNI LOOP', 'History', 'For me 2', ...MENU_THEN_THEME]);
  });

  it('is the one every /ask page shows: the layout renders AskBar, with History and For me, and draws no header of its own', () => {
    const layout = readFileSync(new URL('../../app/ask/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toMatch(/<AskBar>\s*<HistoryLink \/>\s*<ForMeLink count=\{waiting \?\? 0\} \/>\s*<\/AskBar>/);
    expect(layout).not.toContain('<header');
  });
});

describe('on a phone', () => {
  const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('the /ask header\'s end wraps, rather than push the page sideways', () => {
    expect(css('../ask/ask.css')).toMatch(/\.ask-bar-end \{[^}]*flex-wrap: wrap;/);
  });

  it('Game mode, on a row of its own, keeps the right end of it, in the /ask header and the /knowledge bar', () => {
    expect(css('../ask/ask.css')).toMatch(/\.ask-bar-end > \.game-mode \{ margin-left: auto; \}/);
    expect(css('../knowledge/knowledge.css')).toMatch(/\.km-bar-end > \.game-mode \{ margin-left: auto; \}/);
  });
});
