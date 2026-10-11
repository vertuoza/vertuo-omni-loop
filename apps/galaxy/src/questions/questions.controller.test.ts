import { describe, expect, it } from 'vitest';
import { parseOutboxItemId, parseProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { AnswerReplySchema } from './questions.contract';
import { answerQuestion, type QuestionsHandlerDeps } from './questions.controller';
import type { Settled } from './questions.repository';
import { questionsService, type QuestionsDeps } from './questions.service';

// POST /api/outbox/answer (PRD 1548 s9, acceptance 9), with a fake outbox behind the real service: the
// session is checked before anything is read, a malformed body is refused before the service runs, an
// answer settles the question in the contract's shape, and a non-member's answer is refused as no such
// PRD, as is a question already settled.

const URL_ = 'https://omni.example/api/outbox/answer';
const PRD = parseProductPrdId('mobile-12');
const ITEM = parseOutboxItemId('s2-01-quote-totals');

const BODY = [
  '---', `id: ${ITEM}`, `prd: ${PRD}`, 'slice: s2', 'rank: high', 'bears-on: none', 'raised: 2026-10-11', 'wave: 1', '---', '',
  '## The question, in plain words', '', 'Quote totals: round per line or on the total?', '',
  '## The decision, in plain words', '', 'Each line is rounded.', '',
  '## The intro, for fun', '', 'Pennies add up.', '',
  '## The punchline, for fun', '', 'So do the lines.', '',
  '## The options, in plain words', '', 'A. Round per line (built).', 'B. Round on the total.', '',
  '## What I had to decide', '', 'Where the rounding happens.', '',
  '## What I did meanwhile', '', 'Round each line.', '',
  '## What it costs to change later', '', 'One function.', '',
  '## What I could not know', '', '(author) The spec says nothing.', '',
].join('\n');

const OPEN = { item: ITEM, rank: 'high' as const, repository: 'vertuoza/vertuo-api', body: BODY, raisedAt: '2026-10-11T09:00:00Z', settlement: null };

type World = { member?: boolean; settled?: boolean; settle?: Settled; throws?: boolean };

function world({ member = true, settled = false, settle, throws = false }: World = {}, signedIn: 'member' | 'out' | 'closed' = 'member') {
  const calls: string[] = [];
  const logged: string[] = [];
  const deps: QuestionsDeps = {
    items: (query) => {
      calls.push(`items ${query.product}-${String(query.prd)}`);
      if (throws) return Promise.reject(new Error('socket hang up'));
      if (!member) return Promise.resolve({ ok: false, kind: 'missing', error: `No PRD ${PRD} in your workspaces.` });
      const settlement = settled ? { verdict: 'agreed' as const, basis: 'stated', answer: 'A', channel: 'questions' as const, settledBy: 'irisa', settledAt: '2026-10-11T10:00:00Z' } : null;
      return Promise.resolve({ ok: true, value: { prdId: PRD, items: [{ ...OPEN, settlement }] } });
    },
    settle: (prd, s) => {
      calls.push(`settle ${prd.key}-${String(prd.seq)} ${s.item} ${s.verdict} ${s.basis} ${s.answer}`);
      return Promise.resolve(settle ?? { ok: true, value: { id: 'st-1', item: s.item, prdId: PRD, verdict: s.verdict, settledAt: '2026-10-11T11:00:00Z' } });
    },
  };
  const handler: QuestionsHandlerDeps = {
    signedIn: () => Promise.resolve(signedIn === 'member' ? questionsService(deps) : signedIn === 'out' ? null : 'closed'),
    log: (line) => { logged.push(line); },
  };
  return { calls, logged, handler };
}

const post = (body: unknown) => new Request(URL_, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const answered = async (res: Response) => ({ status: res.status, body: await res.json() as unknown });

describe('POST /api/outbox/answer', () => {
  it('settles the question with the option picked, and answers the settlement in the contract\'s shape', async () => {
    const { calls, handler } = world();
    const res = await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), handler);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = AnswerReplySchema.parse(await res.json());
    expect(body).toEqual({ item: ITEM, prdId: 'mobile-12', verdict: 'agreed', settledAt: '2026-10-11T11:00:00Z' });
    expect(calls).toEqual(['items mobile-12', 'settle mobile-12 s2-01-quote-totals agreed stated A. Round per line (built).']);
  });

  it('settles an answer of the member\'s own, read by the kit\'s rules', async () => {
    const { calls, handler } = world();
    const res = await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'Round on the total instead, not per line' }), handler);
    expect(await answered(res)).toMatchObject({ status: 200, body: { verdict: 'drifted' } });
    expect(calls[1]).toBe('settle mobile-12 s2-01-quote-totals drifted contradiction-marker Round on the total instead, not per line');
  });

  it('refuses a non-member, who reads no such PRD, before any write', async () => {
    const { calls, handler } = world({ member: false });
    expect(await answered(await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), handler)))
      .toEqual({ status: 404, body: { error: 'No PRD mobile-12 in your workspaces.' } });
    expect(calls).toEqual(['items mobile-12']);
  });

  it('refuses a non-member the database turns away at the write as no such PRD', async () => {
    const { handler } = world({ settle: { ok: false, code: 'P0002', message: 'No PRD mobile-12 in your workspaces.', hint: null } });
    expect(await answered(await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), handler)))
      .toEqual({ status: 404, body: { error: 'No PRD mobile-12 in your workspaces.' } });
  });

  it('refuses a question already settled, read or raced at the write', async () => {
    const read = world({ settled: true });
    expect(await answered(await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'B' }), read.handler)))
      .toEqual({ status: 409, body: { error: 'This question is already settled.' } });
    expect(read.calls).toEqual(['items mobile-12']);
    const raced = world({ settle: { ok: false, code: '22023', message: 'Item s2-01-quote-totals is already settled (agreed).', hint: 'settled' } });
    expect((await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'B' }), raced.handler)).status).toBe(409);
  });

  it('refuses an answer the rules cannot read with 422, and a letter with no option with 400', async () => {
    const { calls, handler } = world();
    expect((await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'Maybe later' }), handler)).status).toBe(422);
    expect((await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'C' }), handler)).status).toBe(400);
    expect(calls.filter((c) => c.startsWith('settle'))).toEqual([]);
  });

  it('checks the session first: signed out 401, no database 503, and no service runs', async () => {
    const out = world({}, 'out');
    expect(await answered(await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), out.handler)))
      .toEqual({ status: 401, body: { error: 'Sign in first to answer a question.' } });
    const closed = world({}, 'closed');
    expect((await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), closed.handler)).status).toBe(503);
    expect([...out.calls, ...closed.calls]).toEqual([]);
  });

  it.each([
    ['no JSON', 'not json'],
    ['no PRD id', { item: ITEM, answer: 'A' }],
    ['a repository PRD number', { prdId: '912', item: ITEM, answer: 'A' }],
    ['a blank answer', { prdId: 'mobile-12', item: ITEM, answer: '   ' }],
    ['a field the contract has not', { prdId: 'mobile-12', item: ITEM, answer: 'A', verdict: 'agreed' }],
    ['a body too large', JSON.stringify({ prdId: 'mobile-12', item: ITEM, answer: 'x'.repeat(40_000) })],
  ])('refuses %s with 400 before the service runs', async (_what, body) => {
    const { calls, handler } = world();
    const res = await answerQuestion(post(body), handler);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'The body must be {"prdId": "<key>-<n>", "item": "<id>", "answer": "<a letter, or your answer>"}.' });
    expect(calls).toEqual([]);
  });

  it('answers a failed write or a failure 500, logged', async () => {
    const write = world({ settle: { ok: false, code: 'XX000', message: 'boom', hint: null } });
    expect(await answered(await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), write.handler)))
      .toEqual({ status: 500, body: { error: 'The answer was not saved. Try again.' } });
    expect(write.logged).toEqual(['questions: The answer was not saved. Try again. (mobile-12 s2-01-quote-totals)']);
    const thrown = world({ throws: true });
    expect((await answerQuestion(post({ prdId: 'mobile-12', item: ITEM, answer: 'A' }), thrown.handler)).status).toBe(500);
    expect(thrown.logged).toEqual(['questions: socket hang up (mobile-12 s2-01-quote-totals)']);
  });
});
