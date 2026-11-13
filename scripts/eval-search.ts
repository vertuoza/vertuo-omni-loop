#!/usr/bin/env node
// node scripts/eval-search.ts <product> <questions file> --key-file <file> [--url <base>] — scores a product's
// MCP server on a set of questions (PRD 2728 s6; `pnpm eval:search`).
//
// The questions file is one JSON array of `{question, expected, set}`: `expected` the id of the entry that
// should come up, `set` a free label such as `natural` or `paraphrase`. Each question goes to the product's
// `search_knowledge`. The script prints, per set, how many questions had the expected id first, how many in the
// top 5, and the mean reciprocal rank, then each question with its rank and the `mode` the search answered in.
//
// The API key is read from the file --key-file names, sent in a request header and never printed: not in the
// output, not in an error (L-GDPR-2). It is never an argument or an environment variable.
//
// A real product's questions name its own knowledge and stay in its own repository (never#11); this repository
// holds a fictional fixture, scripts/eval-search/acme.json.
//
// Exit codes: 0 scored, 1 a bad argument, an unreadable file, or a search that failed.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs as parseCli } from 'node:util';
import { z } from 'zod';
import { scoreSearches } from '../kit/lib/knowledge/search-eval.ts';

const USAGE = 'usage: node scripts/eval-search.ts <product> <questions file> --key-file <file> [--url <base>]';
const DEFAULT_URL = 'https://www.omni-loop.xyz';
const TOP = 5;

const QuestionsSchema = z.array(z.object({ question: z.string().min(1), expected: z.string().min(1), set: z.string().min(1) }));
export type Question = z.infer<typeof QuestionsSchema>[number];

/** What a search answered: the ids of its hits, best first, and the mode it ranked in (null when it said none). */
export type Found = { ids: string[]; mode: string | null };
export type Search = (question: string) => Promise<Found>;

/** One question scored: its place among the hits (1 is first), or null when the expected id did not come up. */
export type Scored = Question & { rank: number | null; mode: string | null; ids: string[] };

/** The questions of a file's text; throws a one-line error when it is not the shape above. */
export function parseQuestions(text: string): Question[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('the questions file is not valid JSON');
  }
  const parsed = QuestionsSchema.safeParse(raw);
  if (!parsed.success) throw new Error('the questions file must be an array of {question, expected, set}');
  return parsed.data;
}

/** Asks each question in order and notes where its expected id came. */
export async function score(questions: readonly Question[], search: Search): Promise<Scored[]> {
  const scored: Scored[] = [];
  for (const q of questions) {
    const found = await search(q.question);
    const at = found.ids.indexOf(q.expected);
    scored.push({ ...q, rank: at < 0 ? null : at + 1, mode: found.mode, ids: found.ids });
  }
  return scored;
}

/** One set's totals. */
export type Summary = { set: string; questions: number; first: number; top: number; mrr: number };

/** The totals per set, in the order the sets first appear. */
export function summarize(scored: readonly Scored[]): Summary[] {
  const sets = [...new Set(scored.map((s) => s.set))];
  return sets.map((set) => {
    const mine = scored.filter((s) => s.set === set);
    const m = scoreSearches(mine.map((s) => ({ category: set, ranked: s.ids, right: [s.expected] }))).overall;
    return { set, questions: mine.length, first: Math.round(m.top1 * m.questions), top: Math.round(m.top5 * m.questions), mrr: m.mrr };
  });
}

/** The report: a line per set, then a line per question. */
export function report(scored: readonly Scored[]): string {
  const lines = summarize(scored).map(
    (s) => `${s.set}: ${s.questions} questions · first ${s.first} · top ${TOP} ${s.top} · MRR ${s.mrr.toFixed(2)}`,
  );
  lines.push('');
  for (const s of scored) {
    lines.push(`${s.set} · rank ${s.rank === null ? '-' : s.rank} · ${s.mode ?? 'no mode'} · ${s.question} (${s.expected})`);
  }
  return lines.join('\n');
}

const AnswerSchema = z.object({
  result: z.object({ content: z.array(z.object({ text: z.string() })), isError: z.boolean().optional() }),
});
const HitsSchema = z.object({ hits: z.array(z.object({ id: z.string() })), mode: z.string().optional() });

/** The ids and mode a tool result carries; throws a one-line error, never one that holds the key. */
function readAnswer(raw: unknown): Found {
  const answer = AnswerSchema.safeParse(raw);
  if (!answer.success) throw new Error('the server did not answer a tool result');
  if (answer.data.result.isError === true) throw new Error('the search was refused: check the key and that the product\'s MCP server is on');
  let body: unknown;
  try {
    body = JSON.parse(answer.data.result.content[0]?.text ?? '');
  } catch {
    throw new Error('the search did not answer JSON');
  }
  const hits = HitsSchema.safeParse(body);
  if (!hits.success) throw new Error('the search did not answer hits');
  return { ids: hits.data.hits.map((h) => h.id), mode: hits.data.mode ?? null };
}

/** A `search_knowledge` call over a product's MCP URL, with the key in a header and in no message. */
export function mcpSearch(url: string, key: string, doFetch: typeof fetch = fetch): Search {
  return async (question) => {
    let response: Response;
    try {
      response = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${key}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_knowledge', arguments: { query: question } } }),
      });
    } catch {
      throw new Error('the search could not reach the server');
    }
    if (!response.ok) throw new Error(`the server answered ${response.status}`);
    return readAnswer(await response.json().catch(() => null));
  };
}

type Io = { fetch?: typeof fetch; out?: (line: string) => void; err?: (line: string) => void };
type Args = { product: string; file: string; keyFile: string; base: string };

/** The arguments, or null when they do not fit the usage line. */
function parseArgs(argv: readonly string[]): Args | null {
  try {
    const { positionals, values } = parseCli({ args: [...argv], allowPositionals: true, options: { 'key-file': { type: 'string' }, url: { type: 'string' } } });
    const [product, file, ...extra] = positionals;
    const keyFile = values['key-file'];
    if (product === undefined || file === undefined || extra.length > 0 || keyFile === undefined) return null;
    return { product, file, keyFile, base: values.url ?? DEFAULT_URL };
  } catch {
    return null;
  }
}

/** The whole run over its arguments; returns the exit code. */
export async function run(argv: string[], io: Io = {}): Promise<number> {
  const out = io.out ?? ((line: string) => { console.log(line); });
  const err = io.err ?? ((line: string) => { console.error(line); });
  const args = parseArgs(argv);
  if (args === null) {
    err(USAGE);
    return 1;
  }
  try {
    const key = readFileSync(args.keyFile, 'utf8').trim();
    if (key === '') throw new Error('the key file is empty');
    const questions = parseQuestions(readFileSync(args.file, 'utf8'));
    const url = `${args.base.replace(/\/+$/, '')}/api/products/${encodeURIComponent(args.product)}/mcp`;
    out(report(await score(questions, mcpSearch(url, key, io.fetch))));
    return 0;
  } catch (error) {
    err(`eval:search: ${error instanceof Error ? error.message : 'failed'}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await run(process.argv.slice(2)));
