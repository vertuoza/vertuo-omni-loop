import { describe, expect, it } from 'vitest';
import { judgingAfter } from './after-push';

// A push's answer, then the judging after it (PRD 2632 s4): only a dossier the push answered is judged, later.

async function run(answer: Response) {
  const later: (() => Promise<void>)[] = [];
  const judged: string[] = [];
  const out = await judgingAfter(answer, (task) => { later.push(task); }, (id) => { judged.push(id); return Promise.resolve(); });
  expect(judged).toEqual([]);
  await Promise.all(later.map((task) => task()));
  return { out, judged };
}

describe('judging after a push', () => {
  it('judges the dossier a push answered, after the answer, which is handed back untouched', async () => {
    const answer = Response.json({ id: 'd-1', url: 'u', added: [] }, { status: 200 });
    const { out, judged } = await run(answer);
    expect(out).toBe(answer);
    expect(await out.json()).toEqual({ id: 'd-1', url: 'u', added: [] });
    expect(judged).toEqual(['d-1']);
  });

  it('judges nothing on a refusal, an answer without an id, or one that is not JSON', async () => {
    expect((await run(Response.json({ error: 'no' }, { status: 403 }))).judged).toEqual([]);
    expect((await run(Response.json({ url: 'u' }, { status: 200 }))).judged).toEqual([]);
    expect((await run(new Response('not json', { status: 200 }))).judged).toEqual([]);
  });
});
