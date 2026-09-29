import { existsSync, readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { APP_HOME } from './switch';

vi.mock('server-only', () => ({}));
const at = { path: '/app' };
vi.mock('next/navigation', () => ({ usePathname: () => at.path, useRouter: () => ({ refresh: () => {} }) }));

// Every header of the app, as the server renders it (PRD 238). Two kinds since PRD 438:
// - the app's pages (/app, /prd, /ask, /knowledge) sit in the app shell: the sidebar (the crest to
//   /app, the Dashboard, Work, Settings and Omni groups since PRD 572, the page's item marked current) and the top bar (the page's
//   title, the theme switch, then Game mode, last);
// - the public pages (/releases, PRD 262, and /docs) keep the public top bar (TopBar, PRD 346): the
//   OMNI LOOP mark to /app, its menu of Omni's pages (Release notes, Docs: no PRDs), Open the app →
//   to /app, the theme switch and Game mode, last.

const { default: AppLayout } = await import('../../app/app/layout.tsx');
const { default: DossierLayout } = await import('../../app/prd/layout.tsx');
const { default: AskLayout } = await import('../../app/ask/layout.tsx');
const { default: KnowledgeLayout } = await import('../../app/knowledge/layout.tsx');
const { default: ReleasesLayout } = await import('../../app/releases/layout.tsx');
const { default: DocsLayout } = await import('../../app/docs/layout.tsx');

type Layout = (props: { children: React.ReactNode }) => ReactElement | Promise<ReactElement>;

/** A layout around an empty page, rendered at a path. */
const renderAt = async (layout: Layout, path: string) => {
  at.path = path;
  return renderToStaticMarkup((await layout({ children: createElement('p') })) as ReactElement);
};

/** The part of the markup from one tag to its end. */
const part = (html: string, open: string, close: string) => {
  const from = html.indexOf(open);
  expect(from, open).toBeGreaterThanOrEqual(0);
  return html.slice(from, html.indexOf(close, from) + close.length);
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** What a person can press, in order, by name: links and buttons, the Game mode dialog's own left out
 * (it is closed until Game mode opens it). */
const controls = (bar: string) =>
  [...bar.replace(/<dialog[\s\S]*?<\/dialog>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => text(m[2]));

/** The theme switch, Omni first (PRD 284), then Game mode. */
const THEME_THEN_GAME = ['Omni', 'Light', 'Dark', 'Game mode'];

/** Each app page: its layout, a path under it, the sidebar item marked current, the top bar's title. */
const APP_PAGES: Array<[string, Layout, string, string]> = [
  ['/app', AppLayout, '/app', 'Home'],
  ['/app/fleet', AppLayout, '/app/fleet', 'Fleet'],
  ['/app/workspace', AppLayout, '/app/workspace', 'Workspace'],
  ['/app/settings/fleets', AppLayout, '/app/settings/fleets', 'Fleets'],
  ['/prd', DossierLayout, '/prd', 'PRDs'],
  ['/prd/<id>', DossierLayout, '/prd', 'PRDs'],
  ['/ask', AskLayout, '/ask', 'Questions'],
  ['/ask/<session>', AskLayout, '/ask', 'Questions'],
  ['/ask/for-me', AskLayout, '/ask/for-me', 'Questions / Shared with me'],
  ['/ask/history', AskLayout, '/ask/history', 'Questions / History'],
  ['/knowledge', KnowledgeLayout, '/knowledge', 'Knowledge'],
];
const pathOf = (name: string) => name.replace('<id>', '3f2a').replace('<session>', '7c1e');

describe('every app page', () => {
  it.each(APP_PAGES)('%s: sits in the app shell, the sidebar before the top bar before the page', async (name, layout) => {
    const html = await renderAt(layout, pathOf(name));
    expect(html).toMatch(/<div class="ask app-shell[^"]*"><script/);
    const side = html.indexOf('<aside class="app-sidebar"'), bar = html.indexOf('<header class="app-bar"'), main = html.indexOf('<main class="ask-main">');
    expect(side).toBeGreaterThan(0);
    expect(bar).toBeGreaterThan(side);
    expect(main).toBeGreaterThan(bar);
    expect(html).not.toContain('top-bar');
    expect(html).not.toContain('ask-bar');
  });

  it.each(APP_PAGES)('%s: the sidebar\'s crest leads to /app, and lists Dashboard, Work, Settings then Omni', async (name, layout) => {
    const side = part(await renderAt(layout, pathOf(name)), '<aside', '</aside>');
    expect(side).toMatch(new RegExp(`<a class="app-sidebar-crest" href="${APP_HOME}">`));
    expect(controls(side)).toEqual(['OMNI LOOP', 'Home', 'Fleet', 'Workspace', 'PRDs', 'Bug Fixes', 'Visual Updates', expect.stringMatching(/^Questions( \d+)?$/), expect.stringMatching(/^Shared with me( \d+)?$/), 'History', 'Knowledge', 'Fleets', 'Docs', 'Release notes']);
  });

  it.each(APP_PAGES)('%s: marks exactly one sidebar item current: %s', async (name, layout, current) => {
    const side = part(await renderAt(layout, pathOf(name)), '<aside', '</aside>');
    expect([...side.matchAll(/href="([^"]+)"[^>]*aria-current="page"/g)].map((m) => m[1])).toEqual([current]);
  });

  it.each(APP_PAGES)('%s: the top bar reads the page\'s title, then the theme switch, then Game mode, then you, last', async (name, layout, _, title) => {
    const bar = part(await renderAt(layout, pathOf(name)), '<header class="app-bar"', '</header>');
    expect(bar).toContain(`<p class="app-bar-title">${title}</p>`);
    // The user menu's own items left out: it is closed until the avatar opens it.
    // The bell's panel left out too (PRD 499): it is closed until the bell opens it.
    const shown = bar.replace(/<div [^>]*role="menu"[\s\S]*?<\/div><\/div>/g, '').replace(/<div [^>]*class="bell-panel"[\s\S]*?<\/div>(?=<\/div><\/span><span class="app-bar-you">)/, '');
    // ☰ and the crest open the bar for a phone only (PRD 438 s3): the stylesheet hides them from 900px.
    expect(controls(shown).slice(0, 2)).toEqual(['☰', '']);
    // Signed in, the bell (PRD 499) sits after Game mode, before you.
    const bell = /class="bell-button"/.test(shown) ? [expect.stringMatching(/^\d*$/)] : [];
    expect(controls(shown).slice(2, -1)).toEqual([...THEME_THEN_GAME, ...bell]);
    expect(shown).toMatch(/aria-haspopup="menu"|>Sign in with GitHub<\/button>/);
    expect(bar).toMatch(/<dialog [^>]*class="game-mode-dialog"/);
    expect(bar).not.toMatch(/<dialog [^>]*\bopen\b/);
    expect(bar).not.toContain('data-choice="system"');
  });
});

const PUBLIC: Array<[string, Layout, string]> = [
  ['/releases', ReleasesLayout, '/releases'],
  ['/docs', DocsLayout, '/docs'],
];
/** The public bar's menu, Open the app →, then the theme switch and Game mode. */
const MENU_THEN_THEME = ['Release notes', 'Docs', 'Open the app →', ...THEME_THEN_GAME];

describe('the public pages', () => {
  it.each(PUBLIC)('%s: keep the public top bar, and no sidebar', async (name, layout) => {
    const html = await renderAt(layout, name);
    expect(html).toMatch(/<header class="ask-bar top-bar[" ]/);
    expect(html).not.toContain('app-sidebar');
    expect(html).not.toContain('app-bar');
  });

  it.each(PUBLIC)('%s: the OMNI LOOP mark leads to /app, then the menu, Open the app →, the theme switch and Game mode, last', async (name, layout) => {
    const bar = part(await renderAt(layout, name), '<header', '</header>');
    expect(bar).toMatch(new RegExp(`<a class="ask-mark" href="${APP_HOME}">OMNI LOOP</a>`));
    expect(controls(bar).slice(-7)).toEqual(MENU_THEN_THEME);
    expect(bar).toContain(`<a class="top-bar-open" href="${APP_HOME}">Open the app →</a>`);
    expect(controls(bar)).not.toContain('PRDs');
    expect(bar).toMatch(/<dialog [^>]*class="game-mode-dialog"/);
    expect(bar).not.toMatch(/<dialog [^>]*\bopen\b/);
    expect(controls(bar)).not.toContain('System');
  });

  it.each(PUBLIC)('%s: marks its own menu item current, and no other', async (name, layout, current) => {
    const bar = part(await renderAt(layout, name), '<header', '</header>');
    expect([...bar.matchAll(/<a [^>]*href="([^"]+)" aria-current="page"/g)].map((m) => m[1])).toEqual([current]);
  });
});

describe('the layouts', () => {
  const source = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

  it.each(['app/app/layout.tsx', 'app/prd/layout.tsx', 'app/ask/layout.tsx', 'app/knowledge/layout.tsx'])(
    '%s renders the app shell with the viewer, and no header of its own',
    (file) => {
      expect(source(file)).toMatch(/<AppShell viewer=\{await viewerLive\(\)\}/);
      expect(source(file)).not.toMatch(/<header|<TopBar|<AskBar|ThemeScript/);
    },
  );

  it.each(['app/releases/layout.tsx', 'app/docs/layout.tsx'])('%s renders the public TopBar, and reads no session', (file) => {
    expect(source(file)).toMatch(/<TopBar\b/);
    expect(source(file)).not.toMatch(/<header|viewer|AppShell|supabase/);
  });

  it('AskBar is gone, and /knowledge draws no bar of its own', () => {
    expect(existsSync(new URL('../ask/page/AskBar.tsx', import.meta.url))).toBe(false);
    expect(source('src/knowledge/KnowledgeScreen.tsx')).not.toMatch(/<header|TopBar/);
  });
});

describe('on a phone', () => {
  const css = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('the public bar\'s end wraps, rather than push the page sideways, Game mode keeping the right end of its row', () => {
    expect(css('../ask/ask.css')).toMatch(/\.ask-bar-end \{[^}]*flex-wrap: wrap;/);
    expect(css('../ask/ask.css')).toMatch(/\.ask-bar-end > \.game-mode \{ margin-left: auto; \}/);
  });

  it('the app\'s top bar wraps its end, rather than push the page sideways', () => {
    expect(css('../nav/app-bar.css')).toMatch(/\.app-bar-end \{[^}]*flex-wrap: wrap;/);
  });
});
