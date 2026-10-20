import { existsSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { pitchMovedTo, productsMovedTo } from './moved';

// Settings › Products moved into the Knowledge home (PRD 2240 s5): /app/settings/products/<id> answers 308
// to the product's Knowledge › Pitch, and /app/settings/products to /app/products, the query kept.

const list = await import('../../../app/app/settings/products/route');
const one = await import('../../../app/app/settings/products/[id]/route');
const at = (path: string) => new URL(path, import.meta.url);

describe('where the old addresses go', () => {
  it.each([
    ['https://omni.example/app/settings/products', 'https://omni.example/app/products'],
    ['https://omni.example/app/settings/products?x=1', 'https://omni.example/app/products?x=1'],
  ])('sends %s to %s', (from, to) => {
    expect(productsMovedTo(new URL(from)).toString()).toBe(to);
  });

  it('sends a product to its Pitch, the id kept encoded', () => {
    expect(pitchMovedTo(new URL('https://omni.example/app/settings/products/p-1?x=1'), 'p-1').toString()).toBe('https://omni.example/app/products/p-1/knowledge/pitch?x=1');
    expect(pitchMovedTo(new URL('https://omni.example/app/settings/products/a%20b'), 'a b').pathname).toBe('/app/products/a%20b/knowledge/pitch');
  });

  it('leaves no page at either old address, and serves the Pitch page', () => {
    expect(existsSync(at('../../../app/app/settings/products/page.tsx'))).toBe(false);
    expect(existsSync(at('../../../app/app/settings/products/[id]/page.tsx'))).toBe(false);
    expect(existsSync(at('../../../app/app/products/[id]/knowledge/pitch/page.tsx'))).toBe(true);
  });
});

describe('GET /app/settings/products', () => {
  it('redirects permanently to /app/products', () => {
    const response = list.GET(new NextRequest('https://omni.example/app/settings/products'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://omni.example/app/products');
  });
});

describe('GET /app/settings/products/<id>', () => {
  it('redirects permanently to the product\'s Knowledge › Pitch', async () => {
    const response = await one.GET(new NextRequest('https://omni.example/app/settings/products/p-1'), { params: Promise.resolve({ id: 'p-1' }) });
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://omni.example/app/products/p-1/knowledge/pitch');
  });
});
