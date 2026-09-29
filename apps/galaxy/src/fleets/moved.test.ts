import { existsSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { FLEETS_PATH, OLD_FLEETS_PATH, fleetsMovedTo } from './moved';

// Fleets moved under Settings (PRD 572): the page is served at /app/settings/fleets, and the old
// /app/fleets answers with a permanent redirect there, the query kept, so a bookmark or an old link
// still lands on the fleets.

const { GET } = await import('../../app/app/fleets/route');
const at = (path: string) => new URL(path, import.meta.url);

describe('where Fleets lives', () => {
  it('is /app/settings/fleets, moved from /app/fleets', () => {
    expect(FLEETS_PATH).toBe('/app/settings/fleets');
    expect(OLD_FLEETS_PATH).toBe('/app/fleets');
  });

  it('serves the fleets page at the new path, and none at the old one', () => {
    expect(existsSync(at('../../app/app/settings/fleets/page.tsx'))).toBe(true);
    expect(existsSync(at('../../app/app/fleets/page.tsx'))).toBe(false);
  });
});

describe('fleetsMovedTo', () => {
  it.each([
    ['https://omni.example/app/fleets', 'https://omni.example/app/settings/fleets'],
    ['https://omni.example/app/fleets?x=1', 'https://omni.example/app/settings/fleets?x=1'],
    ['https://omni.example/app/fleets?x=1&y=two%20words', 'https://omni.example/app/settings/fleets?x=1&y=two%20words'],
    ['http://localhost:3000/app/fleets?x=1#top', 'http://localhost:3000/app/settings/fleets?x=1'],
  ])('sends %s to %s', (from, to) => {
    expect(fleetsMovedTo(new URL(from)).toString()).toBe(to);
  });
});

describe('GET /app/fleets', () => {
  it('redirects permanently to /app/settings/fleets, the query kept', async () => {
    const response = await GET(new NextRequest('https://omni.example/app/fleets?x=1'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://omni.example/app/settings/fleets?x=1');
  });

  it('redirects with no query to the bare new path', async () => {
    const response = await GET(new NextRequest('https://omni.example/app/fleets'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://omni.example/app/settings/fleets');
  });
});
