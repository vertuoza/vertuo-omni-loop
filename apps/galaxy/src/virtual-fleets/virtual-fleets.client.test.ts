import { describe, expect, it } from 'vitest';
import { COULD_NOT, httpVirtualFleetsPort } from './virtual-fleets.client';

// The drawer's call from the browser (PRD 2842 s1): POST /api/virtual-fleets with the workspace, the
// name, the icon and the roles; the fleet as made, or the refusal's words and the field they go under.

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const NEW = { name: 'Night Shift', mascot: 'robot', roles: ['engineer' as const] };

function fetchAnswering(status: number, body: unknown) {
  const sent: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init });
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
  };
  return { fetch: fetch as typeof globalThis.fetch, sent };
}

describe('the virtual fleets client', () => {
  it('posts the new fleet as the signed-in person, and answers the fleet as made', async () => {
    const { fetch, sent } = fetchAnswering(201, { fleet: { name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', mascot: 'robot' } });
    expect(await httpVirtualFleetsPort(WORKSPACE, fetch).create(NEW)).toEqual({ ok: true, fleet: { name: 'night-shift', label: 'Night Shift', color: '#4fb0ff', mascot: 'robot' } });
    expect(sent[0]?.url).toBe('/api/virtual-fleets');
    expect(sent[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(sent[0]?.init?.body))).toEqual({ workspace: WORKSPACE, ...NEW });
  });

  it('answers a refusal\'s words and field, the foot\'s when it names none', async () => {
    expect(await httpVirtualFleetsPort(WORKSPACE, fetchAnswering(422, { error: 'Name taken: choose another', field: 'name' }).fetch).create(NEW))
      .toEqual({ ok: false, field: 'name', message: 'Name taken: choose another' });
    expect(await httpVirtualFleetsPort(WORKSPACE, fetchAnswering(401, { error: 'Sign in first.' }).fetch).create(NEW))
      .toEqual({ ok: false, field: 'form', message: 'Sign in first.' });
  });

  it('says it could not when the answer is out of shape or the network fails', async () => {
    expect(await httpVirtualFleetsPort(WORKSPACE, fetchAnswering(201, { fleet: {} }).fetch).create(NEW)).toEqual({ ok: false, field: 'form', message: COULD_NOT });
    expect(await httpVirtualFleetsPort(WORKSPACE, fetchAnswering(502, '<html>').fetch).create(NEW)).toEqual({ ok: false, field: 'form', message: COULD_NOT });
    const down = (() => Promise.reject(new Error('offline'))) as typeof globalThis.fetch;
    expect(await httpVirtualFleetsPort(WORKSPACE, down).create(NEW)).toEqual({ ok: false, field: 'form', message: COULD_NOT });
  });
});
