import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitingView } from '../waiting/view';
import type { WaitingOutbox, WaitingQuestion } from '../waiting/waiting';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';
import { item } from '../ask/test-item';
import { z } from 'zod';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The app's sidebar as the server renders it (PRD 438): the crest, the workspace's name, the
// Dashboard and Work groups (PRD 572), then the foot's Settings entry and Omni's row (PRD 733), the current
// entry marked, and what waits for the person as badges, from the waiting provider (PRD 499): Questions
// the Questions part, shared ones included, PRDs the Outbox part.

const at = { path: '/app' as string | null };
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));
// next/link as a plain anchor that records each href it links (PRD 657): a soft navigation keeps the
// layout and the waiting polls, so every entry must go through it.
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

const { Sidebar } = await import('./Sidebar.tsx');
/** The release running, as the release workflow stamps it in the root package.json. */
const VERSION = z.looseObject({ version: z.string() }).parse(JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8'))).version;
const { WaitingProvider } = await import('../waiting/WaitingProvider');

const question = (id: string, sharedBy: string | null = null): WaitingQuestion => ({ kind: 'question', id, sessionTitle: 'feat/x', question: 'Why?', askedAt: 1, sharedBy });
/** Five questions wait: two of Ada's own sessions', three shared with her. */
const FIVE = [question('a'), question('b'), question('c', 'Bob'), question('d', 'Bob'), question('e', 'Bob')];
const waiting = (questions: WaitingQuestion[]): WaitingView => ({ questions, unread: false, source: null });

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: null, heroSvg: null, workspaceName: 'Acme', waiting: waiting(FIVE) };

const render = (viewer: ViewerView = ADA, path: string | null = '/app', outbox: WaitingOutbox[] = []) => {
  at.path = path;
  return renderToStaticMarkup(createElement(WaitingProvider, { view: viewer.waiting, outbox, children: createElement(Sidebar, { viewer }) }));
};
const gate = (id: string): WaitingOutbox => ({ kind: 'outbox', id, prd: parsePrd(459), dossierId: 'd459', title: 'Gate', rank: 'high', question: 'Why?' });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: item(m, 1), text: text(item(m, 2)) }));

beforeEach(() => {
  at.path = '/app';
});

describe('the sidebar', () => {
  it('opens with the crest and OMNI LOOP, linked to /app', () => {
    const html = render();
    expect(html).toMatch(/^<aside class="app-sidebar" id="app-sidebar" aria-label="Sidebar">/);
    expect(links(html)[0]).toMatchObject({ text: 'OMNI LOOP' });
    expect(item(links(html), 0).attrs).toContain('href="/app"');
  });

  it('shows the workspace\'s name when there is one, and none when there is not', () => {
    expect(render()).toContain('<p class="app-sidebar-workspace">Acme</p>');
    expect(render({ ...ADA, workspaceName: null })).not.toContain('app-sidebar-workspace');
    expect(render(SIGNED_OUT_VIEWER)).not.toContain('app-sidebar-workspace');
  });

  it('lists Dashboard and Work, then Settings, Docs and Release notes at the foot, in order (PRD 733)', () => {
    const html = render();
    expect(text(html)).toMatch(/^OMNI LOOP « » Acme Dashboard Home Fleet Workspace Engineering Work PRDs Bug Fixes Visual Updates Questions 5 Knowledge Settings Docs Release notes Omni Loop v\d+\.\d+\.\d+$/);
    expect(links(html).slice(1).map((l) => /href="([^"]+)"/.exec(l.attrs)?.[1])).toEqual([
      '/app', '/app/fleet', '/app/workspace', '/app/engineering', '/prd', '/bugs', '/visual', '/ask', '/knowledge', '/app/settings', '/docs', '/releases',
    ]);
  });

  it('has no Settings group, and no Fleets, Repositories, Shared with me or History entry (PRD 733)', () => {
    const html = render();
    expect(html).not.toContain('id="app-sidebar-settings"');
    expect(html).not.toMatch(/<p class="app-sidebar-label"[^>]*>Settings<\/p>/);
    for (const path of ['/app/settings/fleets', '/app/settings/repositories', '/app/settings/business', '/ask/for-me', '/ask/history']) expect(html).not.toContain(`href="${path}"`);
  });

  it('draws each section\'s sprite before its name, hidden from screen readers, at its native size (issue 653)', () => {
    const html = render();
    for (const [path, label] of [['/app', 'Home'], ['/app/fleet', 'Fleet'], ['/prd', 'PRDs'], ['/bugs', 'Bug Fixes'], ['/visual', 'Visual Updates'], ['/knowledge', 'Knowledge'], ['/app/settings', 'Settings']]) {
      expect(html).toMatch(new RegExp(`<a class="app-sidebar-item" href="${path}" title="${label}"[^>]*><span class="app-sidebar-sprite" aria-hidden="true"><svg [^>]*width="16" height="16"[^>]*>.*?</svg></span><span class="app-sidebar-text">${label}</span>`));
    }
  });

  it('draws Questions with no nested lines (PRD 733)', () => {
    const html = render();
    expect(html).toMatch(/href="\/ask"[^>]*>(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?<span class="app-sidebar-text">Questions<\/span>(?:<span[^>]*>\d+<\/span>)?<\/a><\/li>/);
    expect(html).not.toContain('app-sidebar-children');
  });

  it('shows the Questions part\'s count on Questions, the shared ones included, and no other badge', () => {
    const html = render();
    expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask" title="Questions" aria-label="Questions: 5 waiting">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?<span class="app-sidebar-text">Questions<\/span><span class="app-sidebar-badge" aria-hidden="true">5<\/span><\/a>/);
    expect(html.match(/app-sidebar-badge/g)).toHaveLength(1);
  });

  it('counts my own sessions\' questions on Questions too', () => {
    const html = render({ ...ADA, waiting: waiting([question('a')]) });
    expect(html).toMatch(/aria-label="Questions: 1 waiting">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?<span class="app-sidebar-text">Questions<\/span><span class="app-sidebar-badge" aria-hidden="true">1<\/span>/);
  });

  it('shows the Outbox part\'s count on PRDs, and none at 0', () => {
    expect(render(ADA, '/app', [gate('a'), gate('b')])).toMatch(/<a class="app-sidebar-item" href="\/prd" title="PRDs" aria-label="PRDs: 2 waiting">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?<span class="app-sidebar-text">PRDs<\/span><span class="app-sidebar-badge" aria-hidden="true">2<\/span><\/a>/);
    expect(render()).toMatch(/<a class="app-sidebar-item" href="\/prd" title="PRDs">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?<span class="app-sidebar-text">PRDs<\/span><\/a>/);
  });

  it('shows no badge at 0, nor signed out', () => {
    for (const viewer of [{ ...ADA, waiting: waiting([]) }, SIGNED_OUT_VIEWER]) {
      const html = render(viewer);
      expect(html).not.toContain('app-sidebar-badge');
      expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask" title="Questions">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?<span class="app-sidebar-text">Questions<\/span><\/a>/);
    }
  });

  it.each([
    ['/app', '/app'],
    ['/app/fleet', '/app/fleet'],
    ['/app/fleet?fleet=beaver', '/app/fleet'],
    ['/app/workspace', '/app/workspace'],
    ['/app/engineering', '/app/engineering'],
    ['/app/settings', '/app/settings'],
    ['/app/settings/fleets', '/app/settings'],
    ['/app/settings/repositories', '/app/settings'],
    ['/app/settings/business', '/app/settings'],
    ['/prd/3f2a', '/prd'],
    ['/bugs/3f2a', '/bugs'],
    ['/visual/3f2a', '/visual'],
    ['/ask/q/42', '/ask'],
    ['/ask/for-me', '/ask'],
    ['/ask/history', '/ask'],
    ['/knowledge', '/knowledge'],
  ])('on %s marks exactly one item current: %s', (path, current) => {
    const html = render(ADA, path);
    const marked = [...html.matchAll(/href="([^"]+)"[^>]*aria-current="page"/g)].map((m) => m[1]);
    expect(marked).toEqual([current]);
  });

  it('marks nothing on a path it does not know', () => {
    expect(render(ADA, '/nowhere')).not.toContain('aria-current');
    expect(render(ADA, null)).not.toContain('aria-current');
  });

  it('opens Docs and Release notes in a new tab: a new-tab icon and a name ending "(opens in a new tab)" (issue 548)', () => {
    const html = render();
    for (const [path, label] of [['/docs', 'Docs'], ['/releases', 'Release notes']]) {
      expect(html).toContain(`<a class="app-sidebar-item" href="${path}" aria-label="${label} (opens in a new tab)" target="_blank" rel="noopener"><span class="app-sidebar-text">${label}</span><span class="app-sidebar-out" aria-hidden="true"><svg`);
    }
    expect(html.match(/opens in a new tab/g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html).not.toContain('↗');
  });

  it('puts Settings at the foot, then Omni\'s row, unlabelled, with the version running under it (issue 561, PRD 733)', () => {
    const html = render();
    const foot = html.slice(html.indexOf('<div class="app-sidebar-foot">'));
    expect(html.indexOf('</nav>')).toBeLessThan(html.indexOf('<div class="app-sidebar-foot">'));
    expect(foot).toMatch(/^<div class="app-sidebar-foot"><ul class="app-sidebar-items"><li><a class="app-sidebar-item" href="\/app\/settings" title="Settings">.*?<span class="app-sidebar-text">Settings<\/span><\/a><\/li><\/ul><ul class="app-sidebar-links" aria-label="Omni">/);
    expect(links(foot).map((l) => l.text)).toEqual(['Settings', 'Docs', 'Release notes']);
    expect(foot).toContain(`<p class="app-sidebar-version">Omni Loop v${VERSION}</p>`);
    expect(html).not.toContain('id="app-sidebar-omni"');
  });

  it('is closed as a drawer until ☰ opens it: no scrim, no open mark', () => {
    const html = render();
    expect(html).not.toContain('app-drawer-scrim');
    expect(html).not.toContain('data-open');
  });

  it('names each group\'s list by the group: Dashboard and Work by their labels, Omni\'s foot row by its name', () => {
    const html = render();
    expect(html.match(/class="app-sidebar-label"/g)).toHaveLength(2);
    for (const [id, label] of [['dashboard', 'Dashboard'], ['work', 'Work']]) {
      expect(html).toContain(`<p class="app-sidebar-label" id="app-sidebar-${id}">${label}</p><ul class="app-sidebar-items" aria-labelledby="app-sidebar-${id}">`);
    }
    expect(html).toContain('<ul class="app-sidebar-links" aria-label="Omni">');
  });
});

describe('« and the rail (PRD 733)', () => {
  it('carries «, "Collapse the menu", expanded, in the header right after the crest', () => {
    const html = render();
    const head = html.slice(html.indexOf('<div class="app-sidebar-head">'), html.indexOf('<nav'));
    expect(head).toMatch(/OMNI LOOP<\/span><\/a><button type="button" class="app-sidebar-fold" title="Collapse the menu" aria-label="Collapse the menu" aria-expanded="true" aria-controls="app-sidebar">«<\/button>/);
  });

  it('carries », "Expand the menu", collapsed, which the stylesheet shows only in the rail', () => {
    expect(render()).toContain('<button type="button" class="app-sidebar-unfold" title="Expand the menu" aria-label="Expand the menu" aria-expanded="false" aria-controls="app-sidebar">»</button>');
  });

  it('names every sprite entry by its title and its spoken name, so the rail still says each one', () => {
    const html = render(ADA, '/app', [gate('a')]);
    const entries = links(html).filter((l) => l.attrs.includes('class="app-sidebar-item"') && !l.attrs.includes('target="_blank"'));
    expect(entries.map((l) => /title="([^"]+)"/.exec(l.attrs)?.[1])).toEqual(['Home', 'Fleet', 'Workspace', 'Engineering', 'PRDs', 'Bug Fixes', 'Visual Updates', 'Questions', 'Knowledge', 'Settings']);
    for (const entry of entries) {
      const title = /title="([^"]+)"/.exec(entry.attrs)?.[1];
      const spoken = /aria-label="([^"]+)"/.exec(entry.attrs)?.[1] ?? entry.text;
      expect(spoken.startsWith(title ?? '?'), title).toBe(true);
    }
  });

  it('keeps each name in its own span the rail hides from sight only, and a count\'s number in the spoken name', () => {
    const html = render(ADA, '/app', [gate('a'), gate('b')]);
    expect(html).toMatch(/href="\/ask" title="Questions" aria-label="Questions: 5 waiting">.*?<span class="app-sidebar-text">Questions<\/span><span class="app-sidebar-badge" aria-hidden="true">5<\/span>/);
    expect(html).toMatch(/href="\/prd" title="PRDs" aria-label="PRDs: 2 waiting">/);
  });

  it('is drawn from the shell\'s data-menu, which the menu script marks before the first paint', async () => {
    const { AppShell } = await import('./AppShell.tsx');
    const { menuScript } = await import('./menu-rail');
    const { themeScript } = await import('../ask/theme');
    at.path = '/app';
    const html = renderToStaticMarkup(createElement(AppShell, { viewer: SIGNED_OUT_VIEWER, children: null }));
    const root = html.slice(html.indexOf('<div class="ask app-shell">'));
    const scripts = [...root.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.slice(0, 2)).toEqual([themeScript, menuScript]);
    expect(root.indexOf(menuScript)).toBeLessThan(root.indexOf('<aside'));
  });
});

describe('its links (PRD 657)', () => {
  it('makes every entry, the crest included, a next/link: a click changes the page without a document load', () => {
    linked.length = 0;
    const hrefs = links(render(ADA, '/app', [gate('a')])).map((l) => /href="([^"]+)"/.exec(l.attrs)?.[1]);
    expect(hrefs.length).toBeGreaterThan(10);
    expect(linked).toEqual(hrefs);
  });

  it.each([
    ['/prd/3f2a', '/prd'],
    ['/ask/for-me', '/ask'],
    ['/app/settings/fleets', '/app/settings'],
  ])('keeps the highlight on %s through the link, prefix match included: %s', (path, current) => {
    linked.length = 0;
    const marked = links(render(ADA, path)).filter((l) => l.attrs.includes('aria-current="page"'));
    expect(marked).toHaveLength(1);
    expect(item(marked, 0).attrs).toContain(`href="${current}"`);
    expect(linked).toContain(current);
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });

  it('hides the sidebar below 900px unless the drawer is open, and never lets it scroll the page sideways', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 899.98px)'));
    expect(phone).toMatch(/\.app-shell > \.app-sidebar\s*\{[^}]*display:\s*none/);
    expect(phone).toMatch(/\.app-shell > \.app-sidebar\[data-open\]\s*\{[^}]*position:\s*fixed[^}]*max-width:\s*calc\(100vw - \d+px\)/);
  });

  /** The rules inside the last `@media (min-width: 900px)` block: the rail's. */
  const railBlock = () => css.slice(css.lastIndexOf('@media (min-width: 900px)'));
  const outsideComputer = () => css.replace(/@media \(min-width: 900px\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');

  it('hides « and » by default, and shows them only from 900 px, each in the state it changes (PRD 733)', () => {
    expect(css).toMatch(/\.app-sidebar-fold,\s*\.app-sidebar-unfold\s*\{\s*display:\s*none;\s*\}/);
    expect(railBlock()).toMatch(/\.app-shell:not\(\[data-menu='rail'\]\) > \.app-sidebar \.app-sidebar-fold,\s*\.app-shell\[data-menu='rail'\] > \.app-sidebar \.app-sidebar-unfold\s*\{\s*display:\s*inline-grid/);
  });

  it('draws the rail 56 px wide, and only from 900 px: below it the drawer is unchanged (PRD 733)', () => {
    expect(railBlock()).toMatch(/\.ask\.app-shell\[data-menu='rail'\]\s*\{\s*grid-template-columns:\s*56px minmax\(0, 1fr\)/);
    expect(outsideComputer()).not.toContain("data-menu='rail'");
  });

  it('keeps the names said in the rail, hides the foot\'s links and version, and draws a count as a dot (PRD 733)', () => {
    const rail = railBlock();
    expect(rail).toMatch(/\.app-sidebar-text,[\s\S]*?\{[^}]*clip-path:\s*inset\(50%\)/);
    expect(rail).not.toMatch(/\.app-sidebar-text[^{]*\{[^}]*display:\s*none/);
    expect(rail).toMatch(/\.app-sidebar-links,[\s\S]*?\.app-sidebar-version\s*\{\s*display:\s*none/);
    expect(rail).toMatch(/\.app-sidebar-badge\s*\{[^}]*position:\s*absolute[^}]*font-size:\s*0/);
  });
});
