import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SIGNED_OUT_VIEWER, type ViewerView } from '../nav/viewer-view';

// The frame around an ideas board (issue 1996): a signed-in person keeps the app shell, the sidebar with
// Work › Ideas marked current, as on every other Work page; a visitor on a shared link keeps the public
// page, the app's one top bar, its sub-title Ideas.

vi.mock('next/navigation', () => ({ usePathname: () => '/ideas/acme/widgets' }));
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

const { IdeasFrame } = await import('./IdeasFrame');

const ADA: ViewerView = { signedIn: true, name: 'Ada Lovelace', login: 'ada', avatarUrl: null, heroSvg: null, workspaceName: 'Acme', ideasBoard: 'acme/widgets', waiting: null };
const render = (viewer: ViewerView) => renderToStaticMarkup(IdeasFrame({ viewer, children: createElement('section', { className: 'board' }, 'the board') }));

describe('the ideas board\'s frame (issue 1996)', () => {
  it('keeps the app shell for a signed-in person, Ideas marked current', () => {
    const html = render(ADA);
    expect(html).toContain('<div class="ask app-shell">');
    expect(html).toMatch(/href="\/ideas\/acme\/widgets" title="Ideas" aria-current="page"/);
    expect(html).toContain('<main class="ask-main"><section class="board">the board</section></main>');
    expect(html).not.toContain('top-bar-open');
  });

  it('keeps the public page for a visitor: the top bar, its sub-title Ideas, and no sidebar', () => {
    const html = render(SIGNED_OUT_VIEWER);
    expect(html).toContain('<div class="ask">');
    expect(html).toContain('<a class="top-bar-open" href="/app">Open the app →</a>');
    expect(html).toContain('<main class="ask-main"><section class="board">the board</section></main>');
    expect(html).not.toMatch(/app-shell|app-sidebar/);
  });
});
