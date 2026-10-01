import { describe, expect, it } from 'vitest';
import { extractCandidates, extractorFromEnv, readCandidates } from './extract';

// The extraction (PRD 774, spec step 2) with a stubbed fetch: the model's JSON becomes candidates; a
// failure, a broken reply or an unset key give none, never an error. Nothing calls OpenRouter.

const ITEMS = [
  { kind: 'offering', value: 'ERP', quote: 'Vertuo is the ERP for construction firms' },
  { kind: 'Region', value: 'Belgium', quote: 'firms in Belgium' },
];

function answering(content: unknown, status = 200) {
  const calls: Array<{ url: string; body: { model: string; messages: Array<{ role: string; content: string }> }; auth: string | null }> = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('extractCandidates', () => {
  it('returns the parsed candidates of the model\'s reply', async () => {
    const { fetch, calls } = answering(`Here you go:\n\`\`\`json\n${JSON.stringify(ITEMS)}\n\`\`\``);
    const found = await extractCandidates('Vertuo is the ERP for construction firms in Belgium.', 'acme/app/README.md', { apiKey: 'k', fetch });
    expect(found).toEqual([
      { kind: 'offering', value: 'ERP', quote: 'Vertuo is the ERP for construction firms' },
      { kind: 'region', value: 'Belgium', quote: 'firms in Belgium' },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0]!.auth).toBe('Bearer k');
    expect(calls[0]!.body.messages[1]!.content).toContain('acme/app/README.md');
  });

  it('finds none when the model answers an error', async () => {
    const { fetch } = answering(JSON.stringify(ITEMS), 500);
    expect(await extractCandidates('text', 'x', { apiKey: 'k', fetch })).toEqual([]);
  });

  it('finds none when the fetch throws', async () => {
    const fetch = (async () => { throw new Error('offline'); }) as unknown as typeof globalThis.fetch;
    expect(await extractCandidates('text', 'x', { apiKey: 'k', fetch })).toEqual([]);
  });

  it('finds none, and calls nothing, with the key unset', async () => {
    const { fetch, calls } = answering(JSON.stringify(ITEMS));
    expect(await extractCandidates('text', 'x', { apiKey: '  ', fetch })).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(extractorFromEnv({})).toBeNull();
    expect(extractorFromEnv({ OPENROUTER_API_KEY: 'k' })).toBeTypeOf('function');
  });
});

describe('readCandidates', () => {
  it('drops an unknown kind, a value off one line or too long, and an empty quote', () => {
    expect(readCandidates(JSON.stringify([
      { kind: 'buyer', value: 'CFO', quote: 'for CFOs' },
      { kind: 'rival', value: 'A\nB', quote: 'A and B' },
      { kind: 'rival', value: 'x'.repeat(81), quote: 'long' },
      { kind: 'trade', value: 'retail', quote: '  ' },
      { kind: 'trade', value: 'retail', quote: 'shops and retail' },
    ]))).toEqual([{ kind: 'trade', value: 'retail', quote: 'shops and retail' }]);
  });

  it('keeps a Never line of up to 200 characters, and drops a longer one (PRD 839)', () => {
    const line = 'x'.repeat(200);
    expect(readCandidates(JSON.stringify([
      { kind: 'never', value: 'Answer public tenders', quote: 'we don\'t answer public tenders' },
      { kind: 'Never', value: line, quote: 'long' },
      { kind: 'never', value: `${line}x`, quote: 'too long' },
      { kind: 'rival', value: 'x'.repeat(120), quote: 'a rival stays at 80' },
    ]))).toEqual([
      { kind: 'never', value: 'Answer public tenders', quote: 'we don\'t answer public tenders' },
      { kind: 'never', value: line, quote: 'long' },
    ]);
  });

  it('asks the model for what the company says it does not do', async () => {
    const { fetch, calls } = answering('[]');
    await extractCandidates('We don\'t answer public tenders.', 'x', { apiKey: 'k', fetch });
    expect(calls[0]!.body.messages[0]!.content).toMatch(/"never"/);
  });

  it('finds none in a reply that holds no JSON array', () => {
    expect(readCandidates('I found nothing.')).toEqual([]);
    expect(readCandidates('[not json]')).toEqual([]);
    expect(readCandidates(null)).toEqual([]);
    expect(readCandidates('{"kind": "region"}')).toEqual([]);
  });
});
