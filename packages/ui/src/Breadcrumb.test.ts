// Breadcrumb: the crumbs above the item are links, the last names the item, is not a link and is the
// one `aria-current="page"` (it replaces every "back" link).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb.tsx';

describe('Breadcrumb', () => {
  const items = [{ label: 'Work', href: '/work' }, { label: 'PRDs', href: '/prds' }, { label: 'omni-loop-11', href: '/prd/omni-loop-11' }];
  const html = renderToStaticMarkup(createElement(Breadcrumb, { items }));

  it('names the item in its last crumb, marked aria-current, even when that crumb was given a link', () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>omni-loop-11<\/span>/);
    expect(html).not.toContain('/prd/omni-loop-11');
  });

  it('draws each crumb above it as a link', () => {
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="/work"');
    expect(html).toContain('href="/prds"');
  });
});
