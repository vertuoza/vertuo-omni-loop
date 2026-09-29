import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitingView } from '../waiting/view';
import type { WaitingOutbox, WaitingQuestion } from '../waiting/waiting';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';

// The app's sidebar as the server renders it (PRD 438): the crest, the workspace's name, the
// Dashboard, Work and Settings groups (PRD 572), then the Omni group, the current item marked, and what waits for the person as badges, from
// the waiting provider (PRD 499): Questions the Questions part, Shared with me the shared ones.

const at = { path: '/app' as string | null };
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));

const { Sidebar } = await import('./Sidebar.tsx');
/** The release running, as the release workflow stamps it in the root package.json. */
const VERSION = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8')).version;
const { WaitingProvider } = await import('../waiting/WaitingProvider');

const question = (id: string, sharedBy: string | null = null): WaitingQuestion => ({ kind: 'question', id, sessionTitle: 'feat/x', question: 'Why?', askedAt: 1, sharedBy });
/** Five questions wait: two of Ada's own sessions', three shared with her. */
const FIVE = [question('a'), question('b'), question('c', 'Bob'), question('d', 'Bob'), question('e', 'Bob')];
const waiting = (questions: WaitingQuestion[]): WaitingView => ({ questions, unread: false, source: null });

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: null, workspaceName: 'Acme', waiting: waiting(FIVE) };

const render = (viewer: ViewerView = ADA, path: string | null = '/app', outbox: WaitingOutbox[] = []) => {
  at.path = path;
  return renderToStaticMarkup(createElement(WaitingProvider, { view: viewer.waiting, outbox, children: createElement(Sidebar, { viewer }) }));
};
const gate = (id: string): WaitingOutbox => ({ kind: 'outbox', id, prd: 459, dossierId: 'd459', title: 'Gate', rank: 'high', question: 'Why?' });
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1], text: text(m[2]) }));

beforeEach(() => {
  at.path = '/app';
});

describe('the sidebar', () => {
  it('opens with the crest and OMNI LOOP, linked to /app', () => {
    const html = render();
    expect(html).toMatch(/^<aside class="app-sidebar" id="app-sidebar" aria-label="Sidebar">/);
    expect(links(html)[0]).toMatchObject({ text: 'OMNI LOOP' });
    expect(links(html)[0].attrs).toContain('href="/app"');
  });

  it('shows the workspace\'s name when there is one, and none when there is not', () => {
    expect(render()).toContain('<p class="app-sidebar-workspace">Acme</p>');
    expect(render({ ...ADA, workspaceName: null })).not.toContain('app-sidebar-workspace');
    expect(render(SIGNED_OUT_VIEWER)).not.toContain('app-sidebar-workspace');
  });

  it('lists Dashboard, Work, Settings, then Omni, their items in order (PRD 572)', () => {
    const html = render();
    expect(text(html)).toMatch(/^OMNI LOOP Acme Dashboard Home Fleet Workspace Engineering Work PRDs Bug Fixes Visual Updates Questions 5 Shared with me 3 History Knowledge Settings Fleets Repositories Docs Release notes Omni Loop v\d+\.\d+\.\d+$/);
    expect(links(html).slice(1).map((l) => /href="([^"]+)"/.exec(l.attrs)?.[1])).toEqual([
      '/app', '/app/fleet', '/app/workspace', '/app/engineering', '/prd', '/bugs', '/visual', '/ask', '/ask/for-me', '/ask/history', '/knowledge', '/app/settings/fleets', '/app/settings/repositories', '/docs', '/releases',
    ]);
  });

  it('draws each section\'s sprite before its name, hidden from screen readers, at its native size (issue 653)', () => {
    const html = render();
    for (const [path, label] of [['/app', 'Home'], ['/app/fleet', 'Fleet'], ['/prd', 'PRDs'], ['/bugs', 'Bug Fixes'], ['/visual', 'Visual Updates'], ['/knowledge', 'Knowledge']]) {
      expect(html).toMatch(new RegExp(`<a class="app-sidebar-item" href="${path}"[^>]*><span class="app-sidebar-sprite" aria-hidden="true"><svg [^>]*width="16" height="16"[^>]*>.*?</svg></span>${label}`));
    }
    expect(html).toMatch(/href="\/app\/settings\/fleets">Fleets<\/a>/);
    expect(html).toMatch(/href="\/ask\/history">History<\/a>/);
  });

  it('nests For me and History under Questions', () => {
    const html = render();
    expect(html).toMatch(/href="\/ask"[^>]*>(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?Questions(?:<span[^>]*>\d+<\/span>)?<\/a><ul class="app-sidebar-children">.*href="\/ask\/for-me".*href="\/ask\/history".*<\/ul><\/li>/);
  });

  it('shows the Questions part\'s count on Questions, and the shared ones\' on Shared with me', () => {
    const html = render();
    expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask" aria-label="Questions: 5 waiting">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?Questions<span class="app-sidebar-badge" aria-hidden="true">5<\/span><\/a>/);
    expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask\/for-me" aria-label="Shared with me: 3 waiting">Shared with me<span class="app-sidebar-badge" aria-hidden="true">3<\/span><\/a>/);
  });

  it('shows no Shared with me badge when only my own sessions ask', () => {
    const html = render({ ...ADA, waiting: waiting([question('a')]) });
    expect(html).toMatch(/aria-label="Questions: 1 waiting">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?Questions<span class="app-sidebar-badge" aria-hidden="true">1<\/span>/);
    expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask\/for-me">Shared with me<\/a>/);
  });

  it('shows the Outbox part\'s count on PRDs, and none at 0', () => {
    expect(render(ADA, '/app', [gate('a'), gate('b')])).toMatch(/<a class="app-sidebar-item" href="\/prd" aria-label="PRDs: 2 waiting">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?PRDs<span class="app-sidebar-badge" aria-hidden="true">2<\/span><\/a>/);
    expect(render()).toMatch(/<a class="app-sidebar-item" href="\/prd">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?PRDs<\/a>/);
  });

  it('shows no badge at 0, nor signed out', () => {
    for (const viewer of [{ ...ADA, waiting: waiting([]) }, SIGNED_OUT_VIEWER]) {
      const html = render(viewer);
      expect(html).not.toContain('app-sidebar-badge');
      expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask">(?:<span class="app-sidebar-sprite"[^>]*>.*?<\/span>)?Questions<\/a>/);
      expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask\/for-me">Shared with me<\/a>/);
    }
  });

  it.each([
    ['/app', '/app'],
    ['/app/fleet', '/app/fleet'],
    ['/app/fleet?fleet=beaver', '/app/fleet'],
    ['/app/workspace', '/app/workspace'],
    ['/app/engineering', '/app/engineering'],
    ['/app/settings/fleets', '/app/settings/fleets'],
    ['/app/settings/repositories', '/app/settings/repositories'],
    ['/prd/3f2a', '/prd'],
    ['/bugs/3f2a', '/bugs'],
    ['/visual/3f2a', '/visual'],
    ['/ask/q/42', '/ask'],
    ['/ask/for-me', '/ask/for-me'],
    ['/ask/history', '/ask/history'],
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
      expect(html).toContain(`<a class="app-sidebar-item" href="${path}" aria-label="${label} (opens in a new tab)" target="_blank" rel="noopener">${label}<span class="app-sidebar-out" aria-hidden="true"><svg`);
    }
    expect(html.match(/opens in a new tab/g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html).not.toContain('↗');
  });

  it('puts Omni at the foot, unlabelled, with the version running under it (issue 561)', () => {
    const html = render();
    const foot = html.slice(html.indexOf('<div class="app-sidebar-foot">'));
    expect(html.indexOf('</nav>')).toBeLessThan(html.indexOf('<div class="app-sidebar-foot">'));
    expect(foot).toMatch(/^<div class="app-sidebar-foot"><ul class="app-sidebar-links" aria-label="Omni">/);
    expect(links(foot).map((l) => l.text)).toEqual(['Docs', 'Release notes']);
    expect(foot).toContain(`<p class="app-sidebar-version">Omni Loop v${VERSION}</p>`);
    expect(html).not.toContain('id="app-sidebar-omni"');
  });

  it('is closed as a drawer until ☰ opens it: no scrim, no open mark', () => {
    const html = render();
    expect(html).not.toContain('app-drawer-scrim');
    expect(html).not.toContain('data-open');
  });

  it('names each group\'s list by the group: Dashboard, Work and Settings by their labels, Omni\'s foot row by its name', () => {
    const html = render();
    for (const [id, label] of [['dashboard', 'Dashboard'], ['work', 'Work'], ['settings', 'Settings']]) {
      expect(html).toContain(`<p class="app-sidebar-label" id="app-sidebar-${id}">${label}</p><ul class="app-sidebar-items" aria-labelledby="app-sidebar-${id}">`);
    }
    expect(html).toContain('<ul class="app-sidebar-links" aria-label="Omni">');
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
});
