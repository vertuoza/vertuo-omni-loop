import { describe, expect, it } from 'vitest';
import { demoKnowledgePort, knowledgeClient } from './product-knowledge.client';

// The Knowledge tab's browser client (PRD 1795 s2): one POST to the tab's route, every answer parsed.

const WRITE = { op: 'name', kind: 'legal', role: 'owner', user: null } as const;
const json = (status: number, body: unknown) => Promise.resolve(Response.json(body, { status }));

describe('the client', () => {
  it('posts the change to the tab\'s route and answers what was done', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const client = knowledgeClient('p-1', (url, init) => { seen.push({ url, init }); return json(200, { done: 'named' }); });
    expect(await client.send(WRITE)).toEqual({ ok: true, done: 'named' });
    expect(seen[0]?.url).toBe('/app/products/p-1/knowledge/changes');
    expect(seen[0]?.init.method).toBe('POST');
    expect(seen[0]?.init.body).toBe(JSON.stringify(WRITE));
  });

  it('says the route\'s own words for a refusal', async () => {
    const client = knowledgeClient('p-1', () => json(422, { error: 'Code: one word.' }));
    expect(await client.send(WRITE)).toEqual({ ok: false, message: 'Code: one word.' });
  });

  it('says what happened when the answer is unreadable or the network is down', async () => {
    expect(await knowledgeClient('p-1', () => json(500, 'oops')).send(WRITE)).toEqual({ ok: false, message: 'Nothing was saved (500). Try again.' });
    expect(await knowledgeClient('p-1', () => json(200, { done: 'other' })).send(WRITE)).toEqual({ ok: false, message: 'Nothing was saved (200). Reload the page.' });
    expect(await knowledgeClient('p-1', () => Promise.reject(new Error('offline'))).send(WRITE)).toMatchObject({ ok: false, message: expect.stringContaining('Check your connection') as string });
  });

  it('saves nothing in the demo', async () => {
    expect(await demoKnowledgePort.send(WRITE)).toEqual({ ok: false, message: 'The demo does not save changes.' });
  });
});
