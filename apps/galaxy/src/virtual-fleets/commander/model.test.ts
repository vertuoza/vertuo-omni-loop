import { describe, expect, it } from 'vitest';
import { OPENROUTER_URL } from '../../ask/classify';
import { COMMANDER_MODEL, countedTokens, openRouterCommander, TOOL_ROUNDS, type ModelTurn } from './model';

// The Commander's model call (PRD 3107 s1), on a fake fetch: no test calls OpenRouter. The stable instructions carry the
// cache marker; a question takes at most 3 tool rounds; one message's input stays under its cap; what each call counted
// comes back; a refusal, a timeout or an empty answer is no answer.

type Sent = { url: string; body: Record<string, unknown> };

function fakeFetch(answers: readonly object[]) {
  const sent: Sent[] = [];
  let n = 0;
  const fetch = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const raw = typeof init?.body === 'string' ? init.body : '{}';
    sent.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, body: JSON.parse(raw) as Record<string, unknown> });
    const answer = answers[Math.min(n, answers.length - 1)] ?? {};
    n += 1;
    return Promise.resolve(Response.json(answer));
  };
  return { sent, fetch };
}

const said = (content: string, usage: object = { prompt_tokens: 1000, completion_tokens: 100 }) => ({ choices: [{ message: { role: 'assistant', content } }], usage });
const toolCall = (mission: string) => ({
  choices: [{ message: { role: 'assistant', content: '', tool_calls: [{ id: `call-${mission}`, type: 'function', function: { name: 'older_events', arguments: JSON.stringify({ mission }) } }] } }],
  usage: { prompt_tokens: 500, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 400 } },
});
const turn = (runTool: ModelTurn['runTool'] = () => Promise.resolve('older events: e9 | m1 | …')): ModelTurn => ({
  system: 'The rules.', data: '<fleet_record>…</fleet_record>', tools: [{ type: 'function', function: { name: 'older_events' } }], runTool,
});

describe('the Commander\'s model', () => {
  it('asks OpenRouter\'s Sonnet with the key, the instructions marked for the cache, then the data', async () => {
    const { sent, fetch } = fakeFetch([said('{"verdict": null, "claims": []}')]);
    const answer = await openRouterCommander({ apiKey: 'test-key', fetch })(turn());
    expect(answer).toEqual({ ok: true, content: '{"verdict": null, "claims": []}', tokens: 1100 });
    expect(sent[0]?.url).toBe(OPENROUTER_URL);
    expect(sent[0]?.body.model).toBe(COMMANDER_MODEL);
    expect(COMMANDER_MODEL).toBe('anthropic/claude-sonnet-5.5');
    expect(sent[0]?.body.messages).toEqual([
      { role: 'system', content: [{ type: 'text', text: 'The rules.', cache_control: { type: 'ephemeral' } }] },
      { role: 'user', content: '<fleet_record>…</fleet_record>' },
    ]);
  });

  it('runs a tool call, hands back its result, and counts every call, cache reads left out', async () => {
    const asked: unknown[] = [];
    const { sent, fetch } = fakeFetch([toolCall('m1'), said('{"verdict": "Yes.", "claims": []}')]);
    const answer = await openRouterCommander({ apiKey: 'k', fetch })(turn((name, args) => { asked.push([name, args]); return Promise.resolve('older events: e9'); }));
    expect(asked).toEqual([['older_events', { mission: 'm1' }]]);
    expect(sent[1]?.body.messages).toContainEqual({ role: 'tool', tool_call_id: 'call-m1', content: 'older events: e9' });
    expect(answer).toEqual({ ok: true, content: '{"verdict": "Yes.", "claims": []}', tokens: 120 + 1100 });
  });

  it('takes at most 3 tool rounds, then asks for the answer with no tool', async () => {
    const { sent, fetch } = fakeFetch([toolCall('m1'), toolCall('m1'), toolCall('m1'), said('{"verdict": null, "claims": []}')]);
    const answer = await openRouterCommander({ apiKey: 'k', fetch })(turn());
    expect(answer.ok).toBe(true);
    expect(sent).toHaveLength(TOOL_ROUNDS + 1);
    expect(sent.slice(0, TOOL_ROUNDS).every((s) => 'tools' in s.body)).toBe(true);
    expect(sent[TOOL_ROUNDS]?.body).not.toHaveProperty('tools');
  });

  it('keeps one message\'s input under its cap: a tool result that would pass it is replaced by a line', async () => {
    const { sent, fetch } = fakeFetch([toolCall('m1'), said('{"verdict": null, "claims": []}')]);
    await openRouterCommander({ apiKey: 'k', fetch, inputCap: 20 })(turn(() => Promise.resolve('x'.repeat(400))));
    expect(sent[1]?.body.messages).toContainEqual({ role: 'tool', tool_call_id: 'call-m1', content: 'No more room in this question: answer with what you have.' });
  });

  it('gives no answer on a refusal, an empty answer or a failed call', async () => {
    const refused = (() => Promise.resolve(new Response('no', { status: 429 }))) as typeof globalThis.fetch;
    expect(await openRouterCommander({ apiKey: 'k', fetch: refused })(turn())).toEqual({ ok: false, why: 'OpenRouter answered 429', tokens: 0 });
    expect((await openRouterCommander({ apiKey: 'k', fetch: fakeFetch([said('  ')]).fetch })(turn())).ok).toBe(false);
    const broken = (() => Promise.reject(new Error('The operation was aborted due to timeout'))) as typeof globalThis.fetch;
    expect(await openRouterCommander({ apiKey: 'k', fetch: broken })(turn())).toEqual({ ok: false, why: 'The operation was aborted due to timeout', tokens: 0 });
  });

  it('reads an answer with no message as none, and a tool call\'s broken arguments as none', async () => {
    expect(await openRouterCommander({ apiKey: 'k', fetch: fakeFetch([{ choices: [] }]).fetch })(turn())).toEqual({ ok: false, why: 'OpenRouter answered no message', tokens: 0 });
    const broken = { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'older_events', arguments: '{not json' } }] } }] };
    const asked: unknown[] = [];
    await openRouterCommander({ apiKey: 'k', fetch: fakeFetch([broken, said('{"verdict": null, "claims": []}')]).fetch })(turn((_name, args) => { asked.push(args); return Promise.resolve('none'); }));
    expect(asked).toEqual([{}]);
  });

  it('counts input and output, cache reads left out', () => {
    expect(countedTokens({ prompt_tokens: 1000, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 800 } })).toBe(250);
    expect(countedTokens(undefined)).toBe(0);
  });
});
