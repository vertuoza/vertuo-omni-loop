import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SIGNED_OUT_VIEWER } from '../nav/viewer-view';

// The shell in anti-loop mode (PRD 2490): the root is marked data-ask-mode="anti" in mode anti and
// carries no mark in mode omni; the sidebar draws the Anti-loop group in place of Dashboard and Work and
// keeps the foot; the two route layouts read the viewer per request, not indexed.

vi.mock('next/navigation', () => ({ usePathname: () => '/anti' }));
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return {
    default: (given: Record<string, unknown>) => {
      const props = { ...given };
      delete props.prefetch;
      return h('a', props);
    },
  };
});

const { AppShell } = await import('../nav/AppShell');
const render = (mode?: 'omni' | 'anti') => renderToStaticMarkup(createElement(AppShell, { viewer: SIGNED_OUT_VIEWER, ...(mode ? { mode } : {}), children: createElement('p', null, 'page') }));

describe('AppShell mode', () => {
  it('marks its root data-ask-mode="anti" in mode anti', () => {
    expect(render('anti')).toMatch(/<div class="ask app-shell"[^>]*data-ask-mode="anti"/);
  });

  it('marks nothing in mode omni, the default', () => {
    expect(render('omni')).not.toMatch(/<div class="ask app-shell"[^>]*data-ask-mode/);
    expect(render()).not.toMatch(/<div class="ask app-shell"[^>]*data-ask-mode/);
  });

  it('draws the Anti-loop group in place of Dashboard and Work, and keeps the foot', () => {
    const shell = render('anti');
    expect(shell).toContain('>Anti-loop</p>');
    expect(shell).toContain('>Anti-dashboard</span>');
    expect(shell).toContain('>Anti-work</span>');
    expect(shell).not.toContain('>Dashboard</p>');
    expect(shell).not.toContain('>Work</p>');
    for (const foot of ['Settings', 'Docs', 'Release notes']) expect(shell).toContain(`>${foot}</span>`);
    expect(shell).toContain('ANTI LOOP');
    expect(shell).toContain('Omni loop');
  });

  it('draws the forward menu in mode omni', () => {
    const shell = render('omni');
    expect(shell).toContain('>Dashboard</p>');
    expect(shell).not.toContain('app-sidebar-text">Anti');
  });
});

describe('the anti-loop routes', () => {
  const layout = readFileSync(new URL('../../app/anti/layout.tsx', import.meta.url), 'utf8');

  it('open the shell in mode anti with the viewer read per request, not indexed', () => {
    expect(layout).toContain('<AppShell viewer={await viewerLive()} mode="anti">');
    expect(layout).toContain('robots: { index: false, follow: false }');
  });

  it('store nothing', () => {
    for (const file of ['AntiPage.tsx', 'anti.ts', '../switch/AntiLoopButton.tsx']) {
      expect(readFileSync(new URL(file, import.meta.url), 'utf8'), file).not.toMatch(/cookie|localStorage|sessionStorage/i);
    }
  });
});
