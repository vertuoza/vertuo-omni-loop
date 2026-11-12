import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mcpSearch, parseQuestions, report, run, score, summarize } from './eval-search.ts';

const KEY = 'oma_FAKEKEYFORTESTS0123456789';

/** A fake product MCP: answers each question with the ids listed for it, in the shape the real server uses. */
function fakeMcp(answers: Record<string, string[]>, mode?: string): typeof fetch {
  return (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { params: { arguments: { query: string } } };
    const ids = answers[body.params.arguments.query] ?? [];
    const hits = ids.map((id) => ({ id, kind: 'business-law', title: id, repo: null, domain: null, snippet: '' }));
    const text = JSON.stringify({ hits, total: hits.length, ...(mode === undefined ? {} : { mode }), repositories: [] });
    return Promise.resolve(Response.json({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text }] } }));
  };
}

const QUESTIONS = [
  { question: 'q1', expected: 'A', set: 'natural' },
  { question: 'q2', expected: 'B', set: 'natural' },
  { question: 'q3', expected: 'C', set: 'paraphrase' },
];

describe('scoring', () => {
  it('ranks the expected id, counts first and top 5 per set, and averages the reciprocal rank', async () => {
    const search = mcpSearch('https://x.test/mcp', KEY, fakeMcp({ q1: ['A', 'Z'], q2: ['Z', 'Y', 'X', 'W', 'V', 'B'], q3: ['Z', 'C'] }, 'meaning'));
    const scored = await score(QUESTIONS, search);
    expect(scored.map((s) => s.rank)).toEqual([1, 6, 2]);
    expect(scored.every((s) => s.mode === 'meaning')).toBe(true);
    expect(summarize(scored)).toEqual([
      { set: 'natural', questions: 2, first: 1, top: 1, mrr: (1 + 1 / 6) / 2 },
      { set: 'paraphrase', questions: 1, first: 0, top: 1, mrr: 0.5 },
    ]);
  });

  it('counts an id that never came up as no rank and no credit', async () => {
    const scored = await score(QUESTIONS.slice(0, 1), mcpSearch('https://x.test/mcp', KEY, fakeMcp({})));
    expect(scored[0]).toMatchObject({ rank: null, mode: null });
    expect(summarize(scored)[0]).toMatchObject({ first: 0, top: 0, mrr: 0 });
  });

  it('prints each set, then each question with its rank and mode', async () => {
    const scored = await score(QUESTIONS, mcpSearch('https://x.test/mcp', KEY, fakeMcp({ q1: ['A'] }, 'words')));
    const text = report(scored);
    expect(text).toContain('natural: 2 questions · first 1 · top 5 1 · MRR 0.50');
    expect(text).toContain('natural · rank 1 · words · q1 (A)');
    expect(text).toContain('paraphrase · rank - · words · q3 (C)');
  });
});

describe('the questions file', () => {
  it('refuses what is not an array of {question, expected, set}', () => {
    expect(() => parseQuestions('nope')).toThrow('not valid JSON');
    expect(() => parseQuestions('[{"question":"q"}]')).toThrow('array of');
    expect(parseQuestions(JSON.stringify(QUESTIONS))).toHaveLength(3);
  });

  it('holds the fictional Acme fixture, with the three kinds of set', () => {
    const questions = parseQuestions(readFileSync(new URL('./eval-search/acme.json', import.meta.url), 'utf8'));
    expect(new Set(questions.map((q) => q.set))).toEqual(new Set(['natural', 'paraphrase', 'exact']));
  });
});

describe('the key', () => {
  const folder = mkdtempSync(join(tmpdir(), 'eval-search-'));
  const keyFile = join(folder, 'key');
  const questionsFile = join(folder, 'questions.json');
  writeFileSync(keyFile, `${KEY}\n`);
  writeFileSync(questionsFile, JSON.stringify(QUESTIONS));

  it('is read from its file, sent as a bearer header and never printed', async () => {
    const seen: string[] = [];
    const inner = fakeMcp({ q1: ['A'] }, 'meaning');
    const spy = ((url: string | URL | Request, init?: RequestInit) => {
      seen.push(`${typeof url === 'string' ? url : 'not a string'} ${new Headers(init?.headers).get('authorization')}`);
      return inner(url, init);
    }) as typeof fetch;
    const lines: string[] = [];
    const code = await run(['acme', questionsFile, '--key-file', keyFile, '--url', 'https://x.test/'], { fetch: spy, out: (l) => lines.push(l), err: (l) => lines.push(l) });
    expect(code).toBe(0);
    expect(seen[0]).toBe(`https://x.test/api/products/acme/mcp Bearer ${KEY}`);
    expect(lines.join('\n')).not.toContain(KEY);
  });

  it('is not printed when the search fails either', async () => {
    const down = (() => Promise.reject(new Error(`boom with ${KEY}`))) as typeof fetch;
    const refused = (() => Promise.resolve(new Response(`bad ${KEY}`, { status: 401 }))) as typeof fetch;
    for (const doFetch of [down, refused]) {
      const lines: string[] = [];
      const code = await run(['acme', questionsFile, '--key-file', keyFile], { fetch: doFetch, out: (l) => lines.push(l), err: (l) => lines.push(l) });
      expect(code).toBe(1);
      expect(lines.join('\n')).not.toContain(KEY);
    }
  });

  it('is required as a file: no --key-file is a usage error', async () => {
    const lines: string[] = [];
    expect(await run(['acme', questionsFile], { err: (l) => lines.push(l) })).toBe(1);
    expect(lines[0]).toContain('usage');
  });
});
