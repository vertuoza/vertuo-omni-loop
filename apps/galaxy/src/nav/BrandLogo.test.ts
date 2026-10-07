import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from './BrandLogo';
import { TopBar } from './TopBar';
import { item, present } from '../ask/test/test-item';

// The one OMNI LOOP logo (issue 956): the crest and the wordmark, linked to /app, drawn the same in the
// app's sidebar and on the public bar of /docs and /releases.

const render = (props: Parameters<typeof BrandLogo>[0] = {}) => renderToStaticMarkup(createElement(BrandLogo, props));
const LOGO = /<a class="brand-logo[^"]*" href="\/app"><span class="brand-logo-crest" aria-hidden="true"><svg[\s\S]*?<\/svg><\/span><span class="ask-mark">OMNI LOOP<\/span><\/a>/;

describe('the logo', () => {
  it('reads the crest then OMNI LOOP, linked to /app', () => {
    expect(render()).toMatch(LOGO);
  });

  it('adds the class its place gives it', () => {
    expect(render({ className: 'app-sidebar-crest' })).toMatch(/^<a class="brand-logo app-sidebar-crest" href="\/app">/);
  });

  it('is the one the public bar shows', () => {
    const bar = renderToStaticMarkup(createElement(TopBar, { sub: 'Docs' }));
    expect(bar).toMatch(LOGO);
    expect(bar).toContain(`${item(present(render().match(LOGO), 'the logo'), 0)}<span class="ask-brand-sub">Docs</span>`);
  });

  it('is the one the sidebar shows', () => {
    const source = readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<BrandLogo className="app-sidebar-crest"');
  });
});
