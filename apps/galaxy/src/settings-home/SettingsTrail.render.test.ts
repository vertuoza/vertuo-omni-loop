import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SETTINGS_MAP } from '../nav/settings-map';

const at = vi.hoisted(() => ({ path: '/app/settings/jev' }));
vi.mock('next/navigation', () => ({ usePathname: () => at.path }));

const { SettingsTrail } = await import('./SettingsTrail.tsx');
const render = (path: string) => {
  at.path = path;
  return renderToStaticMarkup(createElement(SettingsTrail));
};

describe('the settings trail (omni-loop-32 s3)', () => {
  for (const group of SETTINGS_MAP) {
    const page = group.pages[0];
    if (!page) continue;
    it(`AC-3: shows "${group.label} › ${page.label}" with the group and the home linking back, on ${page.path}`, () => {
      const html = render(page.path);
      expect(html).toContain('aria-label="Breadcrumb"');
      expect(html).toContain(`<a href="/app/settings">${group.label}</a>`);
      expect(html).toContain(`<span aria-current="page">${page.label}</span>`);
      expect(html).toContain('›');
    });
  }

  it('AC-3: reads every page of the map, so a page added to it has its trail', () => {
    for (const group of SETTINGS_MAP) {
      for (const page of group.pages) {
        const html = render(page.path);
        expect(html).toContain(group.label);
        expect(html).toContain(page.label);
      }
    }
  });

  it('keeps the trail on a page nested under a settings page', () => {
    expect(render('/app/settings/fleets/new')).toContain('<span aria-current="page">Fleets</span>');
  });

  it('draws nothing on the home itself or outside the map', () => {
    expect(render('/app/settings')).toBe('');
    expect(render('/app/settings/unknown')).toBe('');
  });
});
