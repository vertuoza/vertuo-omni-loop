import { describe, it, expect } from 'vitest';
import { FRAME_SANDBOX, SANDBOX_CSP, sandboxedPage } from './sandbox';

// The before/after page's own route, /prd/<id>/v/<version>/page (PRD 216): HTML someone else's Claude
// wrote, served so that it runs in an anonymous origin with no cookies and no network, even opened on
// its own, and not found to anyone who may not read it.

describe('the sandboxed route', () => {
  it('uses exactly the spec\'s policy', () => {
    expect(SANDBOX_CSP).toBe(
      "sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:",
    );
  });

  it('answers the page with the sandbox policy and nosniff, as HTML never kept by a cache', async () => {
    const response = sandboxedPage('<!doctype html><title>After</title>');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).toBe('<!doctype html><title>After</title>');
  });

  it('answers not found, under the same policy, when there is no page the viewer may read', async () => {
    const response = sandboxedPage(null);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-security-policy')).toBe(SANDBOX_CSP);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('Not found');
  });

  it('frames the page with scripts only: no same origin, no forms, no top navigation', () => {
    expect(FRAME_SANDBOX).toBe('allow-scripts');
  });
});
