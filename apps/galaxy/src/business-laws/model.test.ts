import { describe, expect, it } from 'vitest';
import { lawsModel, lawsModelFromEnv } from './model';

// The judge's model call (PRD 2632 s4) on a stubbed fetch: no test reaches OpenRouter.

const answer = (content: unknown, status = 200) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

function stubFetch(reply: Response | Error): { fetch: typeof globalThis.fetch; bodies: string[] } {
  const bodies: string[] = [];
  const fetch = ((_url: string, init?: RequestInit) => {
    bodies.push(typeof init?.body === 'string' ? init.body : '');
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply);
  }) as typeof globalThis.fetch;
  return { fetch, bodies };
}

describe('the judge\'s model', () => {
  it('answers the reply as JSON, a fence around it aside, and masks a token before sending', async () => {
    const { fetch, bodies } = stubFetch(answer('```json\n{"findings": []}\n```'));
    const ask = lawsModel({ key: 'k', fetch });
    // A token-shaped fake, built at run time so no token sits in the source.
    const token = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123'].join('_');
    expect(await ask({ system: 'judge', user: `spec with ${token} inside` })).toEqual({ ok: true, reply: { findings: [] } });
    expect(bodies[0]).not.toContain(token);
    expect(bodies[0]).toContain('[masked]');
    expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({ temperature: 0, response_format: { type: 'json_object' } });
  });

  it('says why on a refusal, a reply that is not JSON, a timeout and no network, never throwing', async () => {
    expect(await lawsModel({ key: 'k', fetch: stubFetch(answer('x', 429)).fetch })({ system: '', user: '' })).toEqual({ ok: false, why: 'OpenRouter answered 429' });
    expect(await lawsModel({ key: 'k', fetch: stubFetch(answer('not json')).fetch })({ system: '', user: '' })).toEqual({ ok: false, why: 'the reply was not JSON' });
    const timeout = Object.assign(new Error('late'), { name: 'TimeoutError' });
    expect(await lawsModel({ key: 'k', fetch: stubFetch(timeout).fetch })({ system: '', user: '' })).toEqual({ ok: false, why: 'it took too long' });
    expect(await lawsModel({ key: 'k', fetch: stubFetch(new Error('offline')).fetch })({ system: '', user: '' })).toEqual({ ok: false, why: 'OpenRouter could not be reached' });
  });

  it('reads the last fenced answer when the model corrects itself in its reply (#2806)', async () => {
    const first = '{"findings": [{"law": "BL-X-1", "quote": "the cart is emptied at midnight", "why": "it breaks the law"}]}';
    const corrected = [
      '```json', first, '```',
      '',
      'Wait, let me reconsider. The spec keeps the cart, so this is not a finding.',
      '',
      '```json', '{"findings": []}', '```',
    ].join('\n');
    expect(await lawsModel({ key: 'k', fetch: stubFetch(answer(corrected)).fetch })({ system: '', user: '' })).toEqual({ ok: true, reply: { findings: [] } });
  });

  it('reads a bare reply, and still says not JSON when the last fenced block or prose holds none', async () => {
    const ask = (content: string) => lawsModel({ key: 'k', fetch: stubFetch(answer(content)).fetch })({ system: '', user: '' });
    expect(await ask(' {"findings": []} ')).toEqual({ ok: true, reply: { findings: [] } });
    expect(await ask('```\n{"findings": []}\n```')).toEqual({ ok: true, reply: { findings: [] } });
    expect(await ask('```json\n{"findings": []}\n```\n\nOn second thought:\n\n```json\n{"findings": [\n```')).toEqual({ ok: false, why: 'the reply was not JSON' });
    expect(await ask('Here is my answer: no findings.')).toEqual({ ok: false, why: 'the reply was not JSON' });
  });

  it('is none without OPENROUTER_API_KEY', () => {
    expect(lawsModelFromEnv(null)).toBeNull();
    expect(lawsModelFromEnv({ key: 'k' })).toBeTypeOf('function');
  });
});
