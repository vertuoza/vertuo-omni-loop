import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SIGNED_OUT_VIEWER, type ViewerView } from './viewer-view';

// The app's sidebar as the server renders it (PRD 438): the crest, the workspace's name, the Work
// group, then the Omni group, the current item marked, For me's count as a badge.

const at = { path: '/app' as string | null };
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));

const { Sidebar } = await import('./Sidebar.tsx');

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: null, workspaceName: 'Acme', forMe: 3 };

const render = (viewer: ViewerView = ADA, path: string | null = '/app') => {
  at.path = path;
  return renderToStaticMarkup(createElement(Sidebar, { viewer }));
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1], text: text(m[2]) }));

beforeEach(() => {
  at.path = '/app';
});

describe('the sidebar', () => {
  it('opens with the crest and OMNI LOOP, linked to /app', () => {
    const html = render();
    expect(html).toMatch(/^<aside class="app-sidebar" aria-label="Sidebar">/);
    expect(links(html)[0]).toMatchObject({ text: 'OMNI LOOP' });
    expect(links(html)[0].attrs).toContain('href="/app"');
  });

  it('shows the workspace\'s name when there is one, and none when there is not', () => {
    expect(render()).toContain('<p class="app-sidebar-workspace">Acme</p>');
    expect(render({ ...ADA, workspaceName: null })).not.toContain('app-sidebar-workspace');
    expect(render(SIGNED_OUT_VIEWER)).not.toContain('app-sidebar-workspace');
  });

  it('lists Work, then Omni, their items in order', () => {
    const html = render();
    expect(text(html)).toMatch(/^OMNI LOOP Acme Work Home PRDs Questions For me 3 History Knowledge Fleets Omni Docs ↗ Release notes ↗$/);
    expect(links(html).slice(1).map((l) => /href="([^"]+)"/.exec(l.attrs)?.[1])).toEqual([
      '/app', '/prd', '/ask', '/ask/for-me', '/ask/history', '/knowledge', '/app/fleets', '/docs', '/releases',
    ]);
  });

  it('nests For me and History under Questions', () => {
    const html = render();
    expect(html).toMatch(/href="\/ask"[^>]*>Questions<\/a><ul class="app-sidebar-children">.*href="\/ask\/for-me".*href="\/ask\/history".*<\/ul><\/li>/);
  });

  it('shows For me\'s count as a badge at 3, and no badge at 0 or when it could not be read', () => {
    expect(render()).toMatch(/<a class="app-sidebar-item" href="\/ask\/for-me" aria-label="For me: 3 waiting">For me<span class="app-sidebar-badge" aria-hidden="true">3<\/span><\/a>/);
    for (const forMe of [0, null]) {
      const html = render({ ...ADA, forMe });
      expect(html).not.toContain('app-sidebar-badge');
      expect(html).toMatch(/<a class="app-sidebar-item" href="\/ask\/for-me">For me<\/a>/);
    }
  });

  it.each([
    ['/app', '/app'],
    ['/app/fleets', '/app/fleets'],
    ['/prd/3f2a', '/prd'],
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

  it('marks Docs and Release notes as leaving the app: a ↗ glyph and a name ending "(leaves the app)"', () => {
    const html = render();
    expect(html).toContain('<a class="app-sidebar-item" href="/docs" aria-label="Docs (leaves the app)">Docs<span class="app-sidebar-out" aria-hidden="true">↗</span></a>');
    expect(html).toContain('<a class="app-sidebar-item" href="/releases" aria-label="Release notes (leaves the app)">Release notes<span class="app-sidebar-out" aria-hidden="true">↗</span></a>');
    expect(html.match(/leaves the app/g)).toHaveLength(2);
  });

  it('names each group\'s list by the group', () => {
    const html = render();
    expect(html).toMatch(/<p class="app-sidebar-label" id="app-sidebar-work">Work<\/p><ul class="app-sidebar-items" aria-labelledby="app-sidebar-work">/);
    expect(html).toMatch(/<p class="app-sidebar-label" id="app-sidebar-omni">Omni<\/p><ul class="app-sidebar-items" aria-labelledby="app-sidebar-omni">/);
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./sidebar.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('names no colour of its own: every colour comes from the ask pages\' tokens', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
  });
});
