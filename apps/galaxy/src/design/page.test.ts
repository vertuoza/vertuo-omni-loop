import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OMNI_LOOP } from '@omni/design';

// /design (app/design/): public, and outside the arcade. It reads no session and no database, so
// it opens for anyone, and it draws nothing of the arcade's.

const { default: Page } = await import('../../app/design/page.tsx');
const { default: Layout, metadata, viewport } = await import('../../app/design/layout.tsx');
const source = (file: string) => readFileSync(new URL(`../../app/design/${file}`, import.meta.url), 'utf8');

describe('the /design route', () => {
  it('renders the design system for anyone: no session, no database', () => {
    const html = renderToStaticMarkup(createElement(Layout, null, Page() as ReactElement));
    expect(html).toContain('class="ds"');
    expect(html).toContain('id="colours"');
  });

  it('imports nothing that reads a session, a database or the arcade', () => {
    for (const file of ['page.tsx', 'layout.tsx']) {
      const imports = [...source(file).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      for (const path of imports) expect(path, `${file}: ${path}`).not.toMatch(/src\/(data|arcade)\/|supabase|next\/headers/);
    }
  });

  it('is titled and coloured by the Omni Loop brand', () => {
    expect(metadata.title).toBeTypeOf('string');
    expect(typeof metadata.title === 'string' ? metadata.title : '').toContain(OMNI_LOOP.name.toUpperCase());
    expect(viewport.themeColor).toBe(OMNI_LOOP.themeColor);
  });
});
