import { describe, expect, it } from 'vitest';
import { parseOutboxItemId, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import type { ItemsQuery, OutboxRefusal } from '../outbox-items/outbox-items.contract';
import type { Settlement } from '../outbox-items/outbox-items.service';
import { questionsService, UNDETERMINED, type QuestionsDeps } from './questions.service';

// Answering on the Questions tab (PRD 1548 s9, acceptance 9), on a fake outbox: a letter settles that
// option (A agreed, any other drifted), an answer of one's own is judged as the kit judges one, an answer
// the rules cannot read is refused, a question already settled or of no PRD the caller reads is refused,
// the settlement goes through the outbox's own service as given on the Questions tab, and its refusals (a
// non-member's no such PRD among them) are answered in the tab's words.

const PRD = parseProductPrdId('mobile-12');
const ITEM = parseOutboxItemId('s2-01-quote-totals');

const itemBody = (id = 's2-01-quote-totals', prd = 'mobile-12') => `---
id: ${id}
prd: ${prd}
slice: s2
rank: high
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Quote totals: round per line or on the total?

## The decision, in plain words

Each line is rounded, then the lines are added.

## The intro, for fun

Pennies add up.

## The punchline, for fun

So do the lines.

## The options, in plain words

A. Round per line (built).
B. Round on the total.

## What I had to decide

Where the rounding happens.

## What I did meanwhile

Round each line.

## What it costs to change later

One function.

## What I could not know

(author) The spec says nothing.
`;

const settledRow = { verdict: 'agreed' as const, basis: 'stated', answer: 'A', channel: 'terminal' as const, settledBy: 'irisa', settledAt: '2026-10-11T10:00:00Z' };
const row = (over: Record<string, unknown> = {}) => ({
  item: ITEM, rank: 'high' as const, repository: 'demo-org/nimbus-api', body: itemBody(), raisedAt: '2026-10-11T09:00:00Z', settlement: null, ...over,
});

function fake(over: Partial<QuestionsDeps> = {}) {
  const asked: ItemsQuery[] = [];
  const settled: Settlement[] = [];
  const deps: QuestionsDeps = {
    items: (query) => { asked.push(query); return Promise.resolve({ ok: true, value: { prdId: PRD, items: [row()] } }); },
    settle: (settlement) => {
      settled.push(settlement);
      return Promise.resolve({ ok: true, value: { id: 'st-1', item: settlement.item, prdId: 'mobile-12', verdict: settlement.verdict, settledAt: '2026-10-11T11:00:00Z' } });
    },
    ...over,
  };
  return { asked, settled, service: questionsService(deps) };
}

describe('answering a question on the Questions tab', () => {
  it('settles option A as agreed, recording the option as given, on the PRD the id names', async () => {
    const { asked, settled, service } = fake();
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toEqual({
      ok: true, value: { item: ITEM, prdId: 'mobile-12', verdict: 'agreed', settledAt: '2026-10-11T11:00:00Z' },
    });
    expect(asked).toEqual([{ product: 'mobile', prd: 12 }]);
    expect(settled).toEqual([{ product: 'mobile', prd: 12, item: ITEM, verdict: 'agreed', basis: 'stated', answer: 'A. Round per line (built).', channel: 'questions' }]);
  });

  it('settles any other option as drifted', async () => {
    const { settled, service } = fake();
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'b' })).toMatchObject({ ok: true, value: { verdict: 'drifted' } });
    expect(settled[0]).toMatchObject({ item: ITEM, verdict: 'drifted', basis: 'stated', answer: 'B. Round on the total.', channel: 'questions' });
  });

  it('judges an answer of one\'s own as the kit does: a plain yes agrees, a change drifts', async () => {
    const yes = fake();
    expect(await yes.service.answer({ prdId: PRD, item: ITEM, answer: 'Yes, keep it' })).toMatchObject({ ok: true });
    expect(yes.settled[0]).toMatchObject({ item: ITEM, verdict: 'agreed', basis: 'affirmation', answer: 'Yes, keep it' });
    const change = fake();
    await change.service.answer({ prdId: PRD, item: ITEM, answer: 'Round on the total instead, not per line' });
    expect(change.settled[0]).toMatchObject({ verdict: 'drifted', basis: 'contradiction-marker' });
  });

  it('refuses an answer the rules cannot read, and a letter with no option, settling nothing', async () => {
    const { settled, service } = fake();
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'Maybe ask the accountant' })).toEqual({ ok: false, kind: 'undetermined', error: UNDETERMINED });
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'D' })).toEqual({ ok: false, kind: 'malformed', error: 'Question s2-01-quote-totals has no option “D”.' });
    expect(settled).toEqual([]);
  });

  it('refuses a question already settled, and one the PRD does not hold, before any write', async () => {
    const done = fake({ items: () => Promise.resolve({ ok: true, value: { prdId: PRD, items: [row({ settlement: settledRow })] } }) });
    expect(await done.service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toEqual({ ok: false, kind: 'settled', error: 'This question is already settled.' });
    const other = fake();
    expect(await other.service.answer({ prdId: PRD, item: parseOutboxItemId('s9-01-other'), answer: 'A' }))
      .toEqual({ ok: false, kind: 'missing', error: 'No question s9-01-other on PRD mobile-12.' });
    expect([...done.settled, ...other.settled]).toEqual([]);
  });

  it('refuses a non-member, who reads no such PRD, and passes on a failed read', async () => {
    const outsider = fake({ items: () => Promise.resolve({ ok: false, kind: 'missing', error: 'No PRD mobile-12 in your workspaces.' }) });
    expect(await outsider.service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toEqual({ ok: false, kind: 'missing', error: 'No PRD mobile-12 in your workspaces.' });
    const failed = fake({ items: () => Promise.resolve({ ok: false, kind: 'database', error: 'The PRD\'s outbox could not be read. Try again.' }) });
    expect(await failed.service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toEqual({ ok: false, kind: 'database', error: 'The PRD\'s outbox could not be read. Try again.' });
    const out = fake({ items: () => Promise.resolve({ ok: false, kind: 'signed-out', error: 'Sign in first.' }) });
    expect(await out.service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toMatchObject({ ok: false, kind: 'signed-out' });
  });

  it('answers the outbox\'s refusals of the settlement in the tab\'s words', async () => {
    type Stored = Awaited<ReturnType<QuestionsDeps['settle']>>;
    const settle = (stored: Stored) => fake({ settle: () => Promise.resolve(stored) }).service.answer({ prdId: PRD, item: ITEM, answer: 'A' });
    const no = (kind: OutboxRefusal, error = 'x'): Stored => ({ ok: false, kind, error });
    expect(await settle(no('missing', 'No PRD mobile-12 in your workspaces.'))).toEqual({ ok: false, kind: 'missing', error: 'No PRD mobile-12 in your workspaces.' });
    expect(await settle(no('settled', 'Item s2-01 is already settled (agreed).'))).toEqual({ ok: false, kind: 'settled', error: 'This question is already settled.' });
    expect(await settle(no('signed-out'))).toEqual({ ok: false, kind: 'signed-out', error: 'Sign in first to answer.' });
    expect(await settle(no('refused'))).toEqual({ ok: false, kind: 'database', error: 'The answer was not saved. Try again.' });
    expect(await settle(no('database'))).toEqual({ ok: false, kind: 'database', error: 'The answer was not saved. Try again.' });
    expect(await settle({ ok: true, value: { nope: true } })).toEqual({ ok: false, kind: 'database', error: 'The answer was not saved. Try again.' });
  });

  it('reads a question whose body no longer parses as having no option and nothing built', async () => {
    const { settled, service } = fake({ items: () => Promise.resolve({ ok: true, value: { prdId: PRD, items: [row({ body: 'not an item' })] } }) });
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toMatchObject({ ok: false, kind: 'malformed' });
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'Verdict: agreed' })).toMatchObject({ ok: true });
    expect(settled[0]).toMatchObject({ verdict: 'agreed', basis: 'stated' });
  });
});
