import { defined, propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { z } from 'zod';
import { maskSecrets, maskState } from './mask';

// The Jev client (PRD 812, decisions 6, 8 and 10): one question to TypeSafe AI's Jev, which answers
// a typed question about a state, and writes no text. The wire shape is TypeSafe's published one: a
// state, and questions keyed by a name the model never reads, each with its type, instructions and
// criteria. One question is asked, named `q`:
//
//   POST https://api.typesafe.ai/v1/systemone
//   Authorization: Bearer <the workspace's key>
//   { model: 'jev-1.13.0', state, questions: { q: question } }
//     question: { type: 'choice', instructions, criteria: { <key>: <description>, … } }
//             | { type: 'score',  instructions, criteria: ['<key>: <description>', …] }   (lowest first)
//             | { type: 'noul',   instructions: <the statement> }                          (how true, 0 to 1)
//   200 { model?, answers: { q: answer } }
//     answer: { type: 'choice', choice, confidence, probabilities? }
//           | { type: 'score',  score, confidence?, probabilities? }
//           | { type: 'noul',   noul }
//
// The caller gets the same back for every type: `answer` (an option's or a level's key, or a Noul's
// number in [0, 1]) and `confidence` in [0, 1]. A Noul carries no confidence, so it is read from how
// far the number sits from 0.5 (|2p - 1|, TypeSafe's peakedness rule for two options). A Score's level
// is the most probable one when Jev sends probabilities (keyed by a level's index, key or criterion),
// and otherwise its `score` read as a position from 0 (the lowest level) to 1 (the highest), rounded;
// without a confidence it gets the peakedness of its probabilities, or 1 minus twice its distance to
// that level. A reply without a model is logged under the pinned one.
//
// The model is pinned (decision 8): a TypeSafe release cannot move answers under a tuned threshold.
// Every string of the state and the question is masked before it is sent (./mask.ts). The call waits
// JEV_TIMEOUT_MS at most and is never retried. It never throws: a non-200 (with TypeSafe's reason), a
// timeout, a network error or a reply outside the question's schema is a `failed` outcome, and the
// caller keeps today's answer (decision 6). `fetch` is injected; nothing here reaches the network on
// its own.

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-1.13.0';
export const JEV_TIMEOUT_MS = 5000;

/** An option of a Choice, or a level of a Score: the key Jev answers, and what it means. */
export interface JevOption {
  key: string;
  description: string;
}

export type JevQuestion =
  | { type: 'choice'; instructions: string; options: JevOption[] }
  | { type: 'score'; instructions: string; levels: JevOption[] }
  | { type: 'noul'; statement: string };

export type JevOutcome =
  | { kind: 'answered'; model: string; answer: string | number; confidence: number; probabilities: Record<string, number> | null; ms: number }
  | { kind: 'failed'; reason: 'status' | 'timeout' | 'network' | 'schema'; status: number | null; message: string; ms: number };

export interface AskJev {
  /** The workspace's TypeSafe API key, opened from the secret box. */
  key: string;
  /** What Jev reads: text, or JSON, as each decision's registry entry builds it. */
  state: unknown;
  question: JevQuestion;
  fetch: typeof globalThis.fetch;
  timeoutMs?: number;
  now?: () => number;
}

const unit = z.number().min(0).max(1);

/** The name the one question is asked under; the model never reads it. */
const Q = 'q';

const probabilities = z.record(z.string(), z.number().min(0)).optional().nullable();

const REPLY = z.object({
  model: z.string().min(1).optional().nullable(),
  answers: z.object({
    [Q]: z.discriminatedUnion('type', [
      z.object({ type: z.literal('choice'), choice: z.string(), confidence: unit, probabilities }),
      z.object({ type: z.literal('score'), score: z.number(), confidence: unit.optional().nullable(), probabilities }),
      z.object({ type: z.literal('noul'), noul: unit }),
    ]),
  }),
});
type Answer = z.infer<typeof REPLY>['answers']['q'];
type Read = { answer: string | number; confidence: number; probabilities: Record<string, number> | null };

const levelLine = (o: JevOption) => `${o.key}: ${maskSecrets(o.description)}`;

/** The question as it is sent: masked, in TypeSafe's shape. */
function sent(question: JevQuestion): Record<string, unknown> {
  switch (question.type) {
    case 'choice':
      return {
        type: 'choice',
        instructions: maskSecrets(question.instructions),
        criteria: Object.fromEntries(question.options.map((o) => [o.key, maskSecrets(o.description)])),
      };
    case 'score':
      return { type: 'score', instructions: maskSecrets(question.instructions), criteria: question.levels.map(levelLine) };
    case 'noul':
      return { type: 'noul', instructions: maskSecrets(question.statement) };
  }
}

/** TypeSafe's peakedness rule: (n × largest − 1) / (n − 1) over n options; null without a spread. */
function peakedness(values: number[]): number | null {
  const n = values.length;
  const total = values.reduce((a, b) => a + b, 0);
  if (n < 2 || total <= 0) return null;
  const largest = Math.max(...values) / total;
  return Math.min(1, Math.max(0, (n * largest - 1) / (n - 1)));
}

/** The level a probability's name points at: its index, its key or its criterion line; -1 for none. */
const levelAt = (levels: JevOption[], name: string) =>
  /^\d+$/.test(name) ? Number(name) : levels.findIndex((l) => name === l.key || name === levelLine(l));

/** A Score's probabilities by level key, or null when one names no level. */
function byLevelOf(levels: JevOption[], probabilities: Record<string, number>): Record<string, number> | null {
  const byLevel: Record<string, number> = {};
  for (const [name, p] of Object.entries(probabilities)) {
    const at = levelAt(levels, name);
    if (!(at >= 0 && at < levels.length)) return null;
    byLevel[defined(levels[at], 'the level').key] = p;
  }
  return byLevel;
}

/** A Score read from its probabilities: the most probable level, sure as its peakedness. */
function scoreByProbabilities(levels: JevOption[], answer: Extract<Answer, { type: 'score' }>, probabilities: Record<string, number>): Read | null {
  const byLevel = byLevelOf(levels, probabilities);
  if (!byLevel) return null;
  const values = levels.map((l) => byLevel[l.key] ?? 0);
  const index = values.indexOf(Math.max(...values));
  return { answer: defined(levels[index], 'the most probable level').key, confidence: answer.confidence ?? peakedness(values) ?? 0, probabilities: byLevel };
}

/** A Score read from its position, 0 the lowest level and 1 the highest, rounded to the nearest. */
function scoreByPosition(levels: JevOption[], answer: Extract<Answer, { type: 'score' }>): Read | null {
  if (answer.score < 0 || answer.score > 1) return null;
  const at = answer.score * (levels.length - 1);
  const index = Math.round(at);
  return { answer: defined(levels[index], 'the nearest level').key, confidence: answer.confidence ?? Math.max(0, 1 - 2 * Math.abs(at - index)), probabilities: null };
}

/** A Score's answer as a level: the most probable one, else its position from 0 to 1, rounded. */
function readScore(levels: JevOption[], answer: Extract<Answer, { type: 'score' }>): Read | null {
  const probabilities = answer.probabilities;
  if (probabilities && Object.keys(probabilities).length) return scoreByProbabilities(levels, answer, probabilities);
  return scoreByPosition(levels, answer);
}

/** The answer as the caller reads it, or null when it does not fit the question. */
function read(question: JevQuestion, answer: Answer): Read | null {
  if (answer.type === 'choice' && question.type === 'choice') {
    if (!question.options.some((o) => o.key === answer.choice)) return null;
    return { answer: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities ?? null };
  }
  if (answer.type === 'noul' && question.type === 'noul') {
    return { answer: answer.noul, confidence: Math.abs(2 * answer.noul - 1), probabilities: null };
  }
  if (answer.type === 'score' && question.type === 'score') return readScore(question.levels, answer);
  return null;
}

/** TypeSafe's reason for a refusal, in its own words when it gave any. */
async function reasonOf(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim();
  if (text) {
    try {
      const body: unknown = JSON.parse(text);
      const error = propertyOf(body, 'error');
      const inner = propertyOf(error, 'message');
      const message = typeof error === 'string' ? error : typeof inner === 'string' ? inner : propertyOf(body, 'message');
      if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  }
  return `TypeSafe answered ${response.status}.`;
}

export async function askJev({ key, state, question, fetch, timeoutMs = JEV_TIMEOUT_MS, now = Date.now }: AskJev): Promise<JevOutcome> {
  const started = now();
  const failed = (reason: Extract<JevOutcome, { kind: 'failed' }>['reason'], message: string, status: number | null = null): JevOutcome =>
    ({ kind: 'failed', reason, status, message, ms: now() - started });
  const abort = new AbortController();
  const timer = setTimeout(() => { abort.abort(); }, timeoutMs);
  let response: Response;
  try {
    response = await fetch(JEV_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state: maskState(state), questions: { [Q]: sent(question) } }),
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (abort.signal.aborted) return failed('timeout', `Jev did not answer within ${timeoutMs / 1000} s.`);
    return failed('network', `Jev could not be reached (${err instanceof Error ? err.message : String(err)}).`);
  }
  try {
    if (!response.ok) return failed('status', await reasonOf(response), response.status);
    const body: unknown = await response.json().catch(() => undefined);
    const reply = REPLY.safeParse(body);
    const answer = reply.success ? read(question, reply.data.answers[Q]) : null;
    if (!reply.success || !answer) return failed('schema', 'Jev answered outside the question\'s schema.', response.status);
    return { kind: 'answered', model: reply.data.model ?? JEV_MODEL, ...answer, ms: now() - started };
  } catch (err) {
    if (abort.signal.aborted) return failed('timeout', `Jev did not answer within ${timeoutMs / 1000} s.`);
    return failed('network', `Jev's answer could not be read (${err instanceof Error ? err.message : String(err)}).`);
  } finally {
    clearTimeout(timer);
  }
}
