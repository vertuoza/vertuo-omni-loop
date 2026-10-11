import { describe, expect, it } from 'vitest';
import { parseOutboxItemId, parseProductPrdId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ItemsQuery } from '../outbox-items/outbox-items.contract';
import { questionsService, tellSettled, UNDETERMINED, type QuestionsDeps, type TellDeps } from './questions.service';
import type { Settled, Settlement } from './questions.repository';

// Answering on the Questions tab (PRD 1548 s9, acceptance 9), on a fake outbox: a letter settles that
// option (A agreed, any other drifted), an answer of one's own is judged as the kit judges one, an answer
// the rules cannot read is refused, a question already settled or of no PRD the caller reads is refused,
// and the database's refusals (a non-member's P0002 among them) are answered in plain words.

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
  item: ITEM, rank: 'high' as const, repository: 'vertuoza/vertuo-api', body: itemBody(), raisedAt: '2026-10-11T09:00:00Z', settlement: null, ...over,
});

function fake(over: Partial<QuestionsDeps> = {}) {
  const asked: ItemsQuery[] = [];
  const settled: { prd: { key: string; seq: number }; settlement: Settlement }[] = [];
  const told: string[] = [];
  const deps: QuestionsDeps = {
    items: (query) => { asked.push(query); return Promise.resolve({ ok: true, value: { prdId: PRD, items: [row()] } }); },
    settle: (prd, settlement): Promise<Settled> => {
      settled.push({ prd, settlement });
      return Promise.resolve({ ok: true, value: { id: 'st-1', item: settlement.item, prdId: 'mobile-12', verdict: settlement.verdict, settledAt: '2026-10-11T11:00:00Z' } });
    },
    settled: (prd) => { told.push(`${prd.key}-${String(prd.seq)}`); return Promise.resolve(); },
    ...over,
  };
  return { asked, settled, told, service: questionsService(deps) };
}

describe('answering a question on the Questions tab', () => {
  it('tells the App once a settlement is stored, and never after a refusal', async () => {
    const ok = fake();
    await ok.service.answer({ prdId: PRD, item: ITEM, answer: 'A' });
    expect(ok.told).toEqual(['mobile-12']);
    const no = fake({ settle: () => Promise.resolve({ ok: false, code: 'P0002', message: null, hint: null }) });
    await no.service.answer({ prdId: PRD, item: ITEM, answer: 'A' });
    await no.service.answer({ prdId: PRD, item: ITEM, answer: 'Maybe' });
    expect(no.told).toEqual([]);
  });

  it('settles option A as agreed, recording the option as given, on the PRD the id names', async () => {
    const { asked, settled, service } = fake();
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toEqual({
      ok: true, value: { item: ITEM, prdId: 'mobile-12', verdict: 'agreed', settledAt: '2026-10-11T11:00:00Z' },
    });
    expect(asked).toEqual([{ product: 'mobile', prd: 12 }]);
    expect(settled).toEqual([{ prd: { key: 'mobile', seq: 12 }, settlement: { item: ITEM, verdict: 'agreed', basis: 'stated', answer: 'A. Round per line (built).' } }]);
  });

  it('settles any other option as drifted', async () => {
    const { settled, service } = fake();
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'b' })).toMatchObject({ ok: true, value: { verdict: 'drifted' } });
    expect(settled[0]?.settlement).toEqual({ item: ITEM, verdict: 'drifted', basis: 'stated', answer: 'B. Round on the total.' });
  });

  it('judges an answer of one\'s own as the kit does: a plain yes agrees, a change drifts', async () => {
    const yes = fake();
    expect(await yes.service.answer({ prdId: PRD, item: ITEM, answer: 'Yes, keep it' })).toMatchObject({ ok: true });
    expect(yes.settled[0]?.settlement).toEqual({ item: ITEM, verdict: 'agreed', basis: 'affirmation', answer: 'Yes, keep it' });
    const change = fake();
    await change.service.answer({ prdId: PRD, item: ITEM, answer: 'Round on the total instead, not per line' });
    expect(change.settled[0]?.settlement).toMatchObject({ verdict: 'drifted', basis: 'contradiction-marker' });
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

  it('answers the database\'s refusals of the settlement in plain words', async () => {
    const settle = (stored: Settled) => fake({ settle: () => Promise.resolve(stored) }).service.answer({ prdId: PRD, item: ITEM, answer: 'A' });
    const no = (code: string | null, hint: string | null = null, message: string | null = null): Settled => ({ ok: false, code, message, hint });
    expect(await settle(no('P0002', null, 'No PRD mobile-12 in your workspaces.'))).toEqual({ ok: false, kind: 'missing', error: 'No PRD mobile-12 in your workspaces.' });
    expect(await settle(no('P0002'))).toEqual({ ok: false, kind: 'missing', error: 'No PRD mobile-12 in your workspaces.' });
    expect(await settle(no('22023', 'settled'))).toEqual({ ok: false, kind: 'settled', error: 'This question is already settled.' });
    expect(await settle(no('42501'))).toEqual({ ok: false, kind: 'signed-out', error: 'Sign in first to answer.' });
    expect(await settle(no('22023', 'answer'))).toEqual({ ok: false, kind: 'database', error: 'The answer was not saved. Try again.' });
    expect(await settle({ ok: true, value: { nope: true } })).toEqual({ ok: false, kind: 'database', error: 'The answer was not saved. Try again.' });
  });

  it('reads a question whose body no longer parses as having no option and nothing built', async () => {
    const { settled, service } = fake({ items: () => Promise.resolve({ ok: true, value: { prdId: PRD, items: [row({ body: 'not an item' })] } }) });
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'A' })).toMatchObject({ ok: false, kind: 'malformed' });
    expect(await service.answer({ prdId: PRD, item: ITEM, answer: 'Verdict: agreed' })).toMatchObject({ ok: true });
    expect(settled[0]?.settlement).toMatchObject({ verdict: 'agreed', basis: 'stated' });
  });
});

describe('telling the App of a settlement', () => {
  function tell(dossierOf: TellDeps['dossierOf'], send: TellDeps['send'] = () => Promise.resolve(true)) {
    const sent: unknown[] = [];
    const logged: string[] = [];
    const settled = tellSettled({ dossierOf, send: (e) => { sent.push(e); return send(e); }, now: () => new Date('2026-10-11T11:00:00Z'), log: (l) => { logged.push(l); } });
    return { sent, logged, settled };
  }

  it('sends item-settled on the PRD\'s dossier, found as the caller', async () => {
    const asked: unknown[] = [];
    const { sent, logged, settled } = tell((prd) => { asked.push(prd); return Promise.resolve({ ok: true, value: 'd-m12' }); });
    await settled({ key: 'mobile', seq: 12 });
    expect(asked).toEqual([{ key: 'mobile', seq: 12, repo: null }]);
    expect(sent).toEqual([{ event: 'item-settled', dossier: 'd-m12', at: '2026-10-11T11:00:00.000Z' }]);
    expect(logged).toEqual([]);
  });

  it('sends nothing, logged, when the dossier cannot be read, and never throws', async () => {
    const none = tell(() => Promise.resolve({ ok: true, value: null }));
    await none.settled({ key: 'mobile', seq: 12 });
    const failed = tell(() => Promise.resolve({ ok: false }));
    await failed.settled({ key: 'mobile', seq: 12 });
    expect([...none.sent, ...failed.sent]).toEqual([]);
    expect(none.logged).toEqual(['questions: the dossier of mobile-12 could not be read, the App is not told of its item-settled']);
    const thrown = tell(() => Promise.resolve({ ok: true, value: 'd-m12' }), () => Promise.reject(new Error('boom')));
    await expect(thrown.settled({ key: 'mobile', seq: 12 })).resolves.toBeUndefined();
    expect(thrown.logged).toEqual(['questions: telling the App of mobile-12\'s item-settled failed — boom']);
  });
});
