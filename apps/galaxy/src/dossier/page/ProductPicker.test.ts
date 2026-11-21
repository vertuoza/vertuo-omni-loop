import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { DossierRow } from '../store';
import { DossierPage } from './DossierPage';
import { ProductField, productChoice } from './ProductPicker';
import { readPick, dossierView } from './view';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));
// The page's own render: where the picker sits, marked; the picker reads once the page runs.
vi.mock('./ProductPicker', async (original) => ({
  ...(await original<typeof import('./ProductPicker')>()),
  ProductPicker: ({ dossier }: { dossier: string }) => createElement('i', { 'data-product-picker': dossier }),
}));

// The PRD page's Product picker (PRD 1364 s7): the workspace's products and No product, the PRD's own
// selected; once an approval is in force, disabled, with `product is locked: PRD <n> is approved`
// beside it. The page shows its cell for a PRD on a deployment with a database, never for a fix.

const MOBILE = { id: '22222222-2222-4222-8222-222222222221', name: 'Mobile' };
const ESTIMATES = { id: '22222222-2222-4222-8222-222222222222', name: 'Estimates' };
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');

describe('the picker', () => {
  it('lists No product then the workspace\'s products, the PRD\'s selected', () => {
    const html = renderToStaticMarkup(createElement(ProductField, { pick: { product: MOBILE, products: [ESTIMATES, MOBILE], locked: null }, busy: false, problem: null, onPick: () => {} }));
    expect(html).toMatch(/<button[^>]*role="combobox"[^>]*aria-label="Product"/);
    expect(html).toContain('<span class="omni-select__value">Mobile</span>');
    expect(html).not.toContain('disabled');
  });

  it('selects No product for a PRD with none', () => {
    const html = renderToStaticMarkup(createElement(ProductField, { pick: { product: null, products: [MOBILE], locked: null }, busy: false, problem: null, onPick: () => {} }));
    expect(html).toMatch(/<span[^>]*class="omni-select__value">No product<\/span>/);
  });

  it('is disabled once an approval is in force, saying why', () => {
    const html = renderToStaticMarkup(createElement(ProductField, { pick: { product: MOBILE, products: [MOBILE], locked: 'product is locked: PRD 7 is approved' }, busy: false, problem: null, onPick: () => {} }));
    expect(html).toMatch(/<button[^>]*aria-label="Product"[^>]*disabled=""|<button[^>]*disabled=""[^>]*aria-label="Product"/);
    expect(textOf(html)).toContain('product is locked: PRD 7 is approved');
  });

  it('is disabled while a change is sent, and shows a refusal in its own words', () => {
    const html = renderToStaticMarkup(createElement(ProductField, { pick: { product: null, products: [MOBILE], locked: null }, busy: true, problem: 'Product: no such product in this workspace.', onPick: () => {} }));
    expect(html).toContain('disabled=""');
    expect(html).toContain('<span class="ask-problem" role="alert">Product: no such product in this workspace.</span>');
  });

  it('reads the option picked as a product id, or none', () => {
    expect(productChoice('')).toBe(null);
    expect(productChoice(MOBILE.id)).toBe(MOBILE.id);
  });
});

describe('on the PRD page', () => {
  const ID = '00000000-0000-4000-8000-0000000000d1';
  const row: DossierRow = {
    id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), title: 'PRD dossiers',
    opened_by: 'u-pierre', created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
  };
  const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };
  const page = (dossier: DossierRow, supabase: typeof SUPABASE | null) => {
    const view = dossierView({ dossier, versions: [], members: [], rounds: [], repos: null, answerable: [] }, 'u-marie', readPick({}), Date.parse('2026-10-10T10:00:00Z'));
    return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase }));
  };

  it('places the picker of a PRD first in About this PRD, before its other facts (omni-loop-20 s6)', () => {
    const html = page(row, SUPABASE);
    expect(html).toContain(`<section class="dossier-about" aria-label="About this PRD"><i data-product-picker="${ID}"></i><dl class="omni-definition-list`);
  });

  it('places none without a database (the demo), nor on a fix', () => {
    expect(page(row, null)).not.toContain('data-product-picker');
    expect(page({ ...row, kind: 'bug' }, SUPABASE)).not.toContain('data-product-picker');
  });
});
