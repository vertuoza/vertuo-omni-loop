import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/app/settings/jev' }));
const started = vi.hoisted(() => ({ reads: 0 }));
vi.mock('../data/viewer', () => ({ viewer: () => { started.reads += 1; return new Promise(() => undefined); } }));

const { SettingsFrame } = await import('./SettingsFrame');

describe('the settings frame (omni-loop-29 s1)', () => {
  it('AC-2: renders the navigation and the page synchronously while the session read is still pending', () => {
    const html = renderToStaticMarkup(createElement(SettingsFrame, null, createElement('p', null, 'the page')));
    expect(started.reads).toBe(1);
    expect(html).toContain('class="settings-nav-list"');
    expect(html).toContain('<p>the page</p>');
  });
});
