import { describe, expect, it } from 'vitest';
import { COULD_NOT, demoHeroesPort, httpHeroesPort } from './heroes.client';

// The tab's calls from the browser (PRD 2842 s6): POST and DELETE /api/virtual-fleets/heroes with the
// workspace and the fleet; the change done, or the refusal's words and the field they belong to.

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const HERO = '22222222-2222-4222-8222-222222222222';
const MADE = { hero: { id: HERO, fleet: 'night-shift', name: 'PM', role: 'pm', skills: ['pitch', 'plan'], agent: 'claude', model: 'opus', limits: [], position: 2 } };

function fetchAnswering(status: number, body: unknown) {
  const sent: { url: string; init: RequestInit | undefined }[] = [];
  const fetch: typeof globalThis.fetch = (url, init) => {
    sent.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, init });
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
  };
  return { fetch, sent };
}

describe('the heroes client', () => {
  it('posts the role with the workspace and the fleet', async () => {
    const { fetch, sent } = fetchAnswering(201, MADE);
    expect(await httpHeroesPort(WORKSPACE, 'night-shift', fetch).add('pm')).toEqual({ ok: true });
    expect(sent[0]?.url).toBe('/api/virtual-fleets/heroes');
    expect(sent[0]?.init?.method).toBe('POST');
    const body = sent[0]?.init?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({ workspace: WORKSPACE, fleet: 'night-shift', role: 'pm' });
  });

  it('deletes the hero with the workspace', async () => {
    const { fetch, sent } = fetchAnswering(200, { removed: HERO });
    expect(await httpHeroesPort(WORKSPACE, 'night-shift', fetch).remove(HERO)).toEqual({ ok: true });
    expect(sent[0]?.init?.method).toBe('DELETE');
    const body = sent[0]?.init?.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({ workspace: WORKSPACE, hero: HERO });
  });

  it('answers a refusal\'s words and field, the foot\'s when it names none', async () => {
    expect(await httpHeroesPort(WORKSPACE, 'f', fetchAnswering(422, { error: 'Hero: a fleet keeps at least one hero.', field: 'hero' }).fetch).remove(HERO))
      .toEqual({ ok: false, field: 'hero', message: 'Hero: a fleet keeps at least one hero.' });
    expect(await httpHeroesPort(WORKSPACE, 'f', fetchAnswering(401, { error: 'Sign in first.' }).fetch).add('qa'))
      .toEqual({ ok: false, field: 'form', message: 'Sign in first.' });
  });

  it('says it could not when the answer is out of shape or the network fails', async () => {
    expect(await httpHeroesPort(WORKSPACE, 'f', fetchAnswering(201, { hero: {} }).fetch).add('qa')).toEqual({ ok: false, field: 'form', message: COULD_NOT });
    expect(await httpHeroesPort(WORKSPACE, 'f', fetchAnswering(502, '<html>').fetch).remove(HERO)).toEqual({ ok: false, field: 'form', message: COULD_NOT });
    const down = (() => Promise.reject(new Error('offline'))) as typeof globalThis.fetch;
    expect(await httpHeroesPort(WORKSPACE, 'f', down).add('qa')).toEqual({ ok: false, field: 'form', message: COULD_NOT });
  });

  it('changes nothing in the demo, and says so', async () => {
    const said = { ok: false, field: 'form', message: 'The demo world keeps its own fleets.' };
    expect(await demoHeroesPort.add('qa')).toEqual(said);
    expect(await demoHeroesPort.remove(HERO)).toEqual(said);
  });
});
