import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SETTINGS_MAP_PAGES } from './settings-map';

const at = vi.hoisted(() => ({ path: '/app/settings/jev' }));
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));
// next/link renders a plain anchor on the server, so the mock records the prefetch prop each link gets.
const seen = vi.hoisted(() => ({ props: [] as { href: string; prefetch?: boolean | null | undefined }[] }));
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children?: unknown }) => {
      seen.props.push({ href, prefetch });
      return h('a', { href, ...rest }, children as string);
    },
  };
});

const { SettingsNav } = await import('./SettingsNav.tsx');
const render = (path: string) => {
  at.path = path;
  return renderToStaticMarkup(createElement(SettingsNav));
};
const links = (html: string) => [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].map((m) => ({
  href: /href="([^"]*)"/.exec(m[1] ?? '')?.[1],
  current: /aria-current="page"/.test(m[1] ?? ''),
  text: m[2],
}));

describe('the settings navigation markup (omni-loop-27 s2)', () => {
  it('draws the grouped list and the narrow form, both in the server markup', () => {
    const html = render('/app/settings/jev');
    expect(html).toContain('class="settings-nav-list"');
    expect(html).toContain('class="settings-nav-select"');
    expect(html).toContain('<details>');
    for (const label of ['Workspace', 'Access', 'Knowledge']) expect(html).toContain(label);
  });

  it('links every page of the map in each form, API keys included', () => {
    const found = links(render('/app/settings/jev')).map((l) => l.href);
    for (const page of SETTINGS_MAP_PAGES) expect(found.filter((h) => h === page.path)).toHaveLength(2);
    expect(found).toContain('/app/settings/api-keys');
  });

  it('marks the page showing aria-current="page" in both forms, and no other', () => {
    const current = links(render('/app/settings/api-keys')).filter((l) => l.current);
    expect(current.map((l) => l.href)).toEqual(['/app/settings/api-keys', '/app/settings/api-keys']);
  });

  it('names the page showing on the narrow form\'s summary', () => {
    expect(render('/app/settings/fleets')).toContain('<summary>Fleets</summary>');
    expect(render('/app/settings')).toContain('<summary>Settings</summary>');
  });

  it('AC-5: prefetches every link, in both forms, so a tab opens at once', () => {
    seen.props.length = 0;
    render('/app/settings/jev');
    expect(seen.props).toHaveLength(SETTINGS_MAP_PAGES.length * 2);
    for (const link of seen.props) expect(link.prefetch).toBe(true);
  });
});
