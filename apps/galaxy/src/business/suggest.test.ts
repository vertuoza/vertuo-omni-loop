import { describe, expect, it } from 'vitest';
import type { Claim } from './model';
import { MAX_GUESSES, readRivals, suggestInput, suggestKey, suggestRivals, SUGGEST_MODEL, type SuggestInput } from './suggest';

// Suggested rivals (PRD 748 s3): what the small model is asked once offering, trade and region are
// picked, and what is kept of its reply: up to five names, none the business already holds in any
// state (so a rejected rival is never suggested again). No key, a non-ok answer, an unparseable reply
// or a throw all give null: the page then shows no guess and no error.

const claim = (seq: number, kind: Claim['kind'], value: string, over: Partial<Claim> = {}): Claim =>
  ({ id: `c-${seq}`, seq, kind, value, source: 'pick', state: 'confirmed', cited: 0, lastBy: null, ...over });

const PICKED: Claim[] = [
  claim(1, 'offering', 'ERP'),
  claim(2, 'trade', 'construction'),
  claim(3, 'region', 'Belgium'),
  claim(4, 'region', 'France'),
  claim(5, 'rival', 'Kept Co'),
  claim(6, 'rival', 'Gone Co', { state: 'rejected' }),
  claim(7, 'rival', 'Maybe Co', { state: 'proposed', source: 'suggestion' }),
];

const INPUT: SuggestInput = { offering: ['ERP'], trade: ['construction'], region: ['Belgium', 'France'], exclude: ['Kept Co', 'Gone Co', 'Maybe Co'] };

const answer = (content: unknown, init: { ok?: boolean; status?: number } = {}) =>
  ({ ok: init.ok ?? true, status: init.status ?? 200, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

function stub(reply: Response | Error) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (reply instanceof Error) throw reply;
    return reply;
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

describe('what the model is asked', () => {
  it('waits for offering, trade and region, each confirmed', () => {
    expect(suggestInput([])).toBeNull();
    expect(suggestInput(PICKED.filter((c) => c.kind !== 'trade'))).toBeNull();
    expect(suggestInput(PICKED.map((c) => (c.kind === 'region' ? { ...c, state: 'proposed' as const } : c)))).toBeNull();
    expect(suggestInput(PICKED)).toEqual(INPUT);
  });

  it('keys the three picks, so a change asks again and a rival does not', () => {
    expect(suggestKey([])).toBeNull();
    const key = suggestKey(PICKED);
    expect(key).toBe('erp|construction|belgium,france');
    expect(suggestKey([...PICKED, claim(8, 'rival', 'New Co')])).toBe(key);
    expect(suggestKey([...PICKED, claim(9, 'region', 'Germany')])).not.toBe(key);
  });
});

describe('the reply', () => {
  it('reads one name a line, list marks and numbers aside, five at most', () => {
    expect(readRivals('1. Alpha\n- Beta\n* Gamma\n4) Delta\nEpsilon\nZeta', [])).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']);
    expect(MAX_GUESSES).toBe(5);
  });

  it('drops a name the business holds in any state, a repeat, and a line too long to be a name', () => {
    expect(readRivals('gone co\nFresh Co\nKEPT CO\nfresh co\nMaybe Co\n' + 'x'.repeat(81), INPUT.exclude)).toEqual(['Fresh Co']);
  });

  it('is null when nothing can be read', () => {
    expect(readRivals('', [])).toBeNull();
    expect(readRivals(42, [])).toBeNull();
    expect(readRivals('Kept Co', INPUT.exclude)).toEqual([]);
  });
});

describe('suggestRivals()', () => {
  it('asks the small model once and answers the parsed names', async () => {
    const s = stub(answer('Alpha\nBeta\nGone Co'));
    expect(await suggestRivals(INPUT, { apiKey: 'k', fetch: s.fetch })).toEqual(['Alpha', 'Beta']);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((s.calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer k');
    const body = JSON.parse(String(s.calls[0].init.body));
    expect(body.model).toBe(SUGGEST_MODEL);
    const user = body.messages.at(-1).content as string;
    for (const said of ['ERP', 'construction', 'Belgium and France', 'Gone Co']) expect(user).toContain(said);
  });

  it('is null with no key, and calls nothing', async () => {
    const s = stub(answer('Alpha'));
    expect(await suggestRivals(INPUT, { apiKey: null, fetch: s.fetch })).toBeNull();
    expect(await suggestRivals(INPUT, { apiKey: '  ', fetch: s.fetch })).toBeNull();
    expect(s.calls).toHaveLength(0);
  });

  it('is null on a non-ok answer, an unparseable reply or a throw', async () => {
    expect(await suggestRivals(INPUT, { apiKey: 'k', fetch: stub(answer('Alpha', { ok: false, status: 500 })).fetch })).toBeNull();
    expect(await suggestRivals(INPUT, { apiKey: 'k', fetch: stub(answer(null)).fetch })).toBeNull();
    const broken = stub({ ok: true, status: 200, json: async () => { throw new SyntaxError('no'); } } as unknown as Response);
    expect(await suggestRivals(INPUT, { apiKey: 'k', fetch: broken.fetch })).toBeNull();
    expect(await suggestRivals(INPUT, { apiKey: 'k', fetch: stub(new Error('down')).fetch })).toBeNull();
  });
});
