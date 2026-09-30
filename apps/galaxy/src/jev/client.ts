import { z } from 'zod';
import { maskSecrets, maskState } from './mask';

// The Jev client (PRD 812, decisions 6, 8 and 10): one question to TypeSafe AI's Jev, which answers
// a typed question about a state, and writes no text.
//
//   POST https://api.typesafe.ai/v1/systemone
//   Authorization: Bearer <the workspace's key>
//   { model: 'jev-1.13.0', state, question }
//     question: { type: 'choice', instructions, options: [{ key, description }] }
//             | { type: 'score',  instructions, levels:  [{ key, description }] }   (lowest first)
//             | { type: 'noul',   statement }                                       (how true, 0 to 1)
//   200 { model, answer, confidence, probabilities? }
//     answer: an option's or a level's key, or a Noul's number in [0, 1]; confidence in [0, 1]
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

const unit = z.number().finite().min(0).max(1);

const REPLY = z.object({
  model: z.string().min(1),
  answer: z.union([z.string(), z.number()]),
  confidence: unit,
  probabilities: z.record(z.string(), z.number()).optional().nullable(),
});

/** The question as it is sent: masked, and only its own keys. */
function sent(question: JevQuestion): JevQuestion {
  const option = (o: JevOption): JevOption => ({ key: o.key, description: maskSecrets(o.description) });
  switch (question.type) {
    case 'choice':
      return { type: 'choice', instructions: maskSecrets(question.instructions), options: question.options.map(option) };
    case 'score':
      return { type: 'score', instructions: maskSecrets(question.instructions), levels: question.levels.map(option) };
    case 'noul':
      return { type: 'noul', statement: maskSecrets(question.statement) };
  }
}

/** Whether the answer fits the question: a listed key, or a Noul's number in [0, 1]. */
function fits(question: JevQuestion, answer: string | number): boolean {
  switch (question.type) {
    case 'choice':
      return typeof answer === 'string' && question.options.some((o) => o.key === answer);
    case 'score':
      return typeof answer === 'string' && question.levels.some((l) => l.key === answer);
    case 'noul':
      return unit.safeParse(answer).success;
  }
}

/** TypeSafe's reason for a refusal, in its own words when it gave any. */
async function reasonOf(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim();
  if (text) {
    try {
      const body = JSON.parse(text) as { error?: unknown; message?: unknown };
      const error = body.error as { message?: unknown } | string | undefined;
      const message = typeof error === 'string' ? error : typeof error?.message === 'string' ? error.message : body.message;
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
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(JEV_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: JEV_MODEL, state: maskState(state), question: sent(question) }),
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
    if (!reply.success || !fits(question, reply.data.answer)) return failed('schema', 'Jev answered outside the question\'s schema.', response.status);
    const { model, answer, confidence, probabilities } = reply.data;
    return { kind: 'answered', model, answer, confidence, probabilities: probabilities ?? null, ms: now() - started };
  } catch (err) {
    if (abort.signal.aborted) return failed('timeout', `Jev did not answer within ${timeoutMs / 1000} s.`);
    return failed('network', `Jev's answer could not be read (${err instanceof Error ? err.message : String(err)}).`);
  } finally {
    clearTimeout(timer);
  }
}
