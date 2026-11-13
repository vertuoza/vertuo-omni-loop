import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProductKeyCard } from './ProductKeyCard';
import type { ProductKeyData } from './product-key';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

// The Product key card as the server draws it (PRD 2784 s1), one state at a time. Fictional product only.

const CARD: ProductKeyData = { name: 'Acme Insight', key: null, owner: true, archived: false };
const draw = (card: Partial<ProductKeyData>) =>
  renderToStaticMarkup(createElement(ProductKeyCard, { card: { ...CARD, ...card }, product: 'p-1', source: { kind: 'demo' } }));

describe('ProductKeyCard', () => {
  it('an owner with no key sees the field prefilled from the name, Set key enabled, and the once line', () => {
    const html = draw({});
    expect(html).toContain('id="product-key"');
    expect(html).toContain('value="acme-insight"');
    expect(html).toMatch(/<button[^>]*>Set key<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Set key<\/button>/);
    expect(html).toContain('Set once. It never changes.');
    expect(html).not.toContain('data-key-rule');
  });

  it('a name that gives a key out of shape keeps Set key disabled and says the rule', () => {
    const html = draw({ name: '2024' });
    expect(html).toContain('Lowercase words joined by -, 40 at most.');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Set key<\/button>/);
  });

  it('another member with no key reads who sets it, with no field', () => {
    const html = draw({ owner: false });
    expect(html).toContain('No key yet.');
    expect(html).toContain('An owner sets it.');
    expect(html).not.toContain('<input');
  });

  it('an archived product with no key reads No key. and offers nothing', () => {
    const html = draw({ archived: true });
    expect(html).toContain('No key.');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
  });

  it('a key set is shown read-only to everyone', () => {
    const html = draw({ key: 'acme', owner: false });
    expect(html).toContain('>acme</code>');
    expect(html).toContain('Set once.');
    expect(html).not.toContain('<input');
  });
});
