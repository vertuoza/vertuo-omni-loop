// @ts-nocheck
// The canon gate (PRD 839) with a stubbed business and a stubbed model: nothing here calls Supabase or
// OpenRouter.
import { describe, expect, it, vi } from 'vitest';
import { CANON_SPEC_LIMIT, createCanon, quoted } from './canon.ts';

const SPEC = [
  '# Group consolidation',
  '',
  'The dashboard designs for the CFO of a six-entity holding,',
  'who closes the books of every company at once.',
].join('\n');

const BUSINESS = Object.freeze({
  state: 'ok',
  business: { name: 'Vertuoza' },
  product: null,
  claims: [
    { id: 'size#1', kind: 'size', value: '2-20', source: 'pick', state: 'confirmed' },
    { id: 'never#4', kind: 'never', value: 'Never: build for groups of companies', source: 'pick', state: 'confirmed' },
  ],
  personas: [
    { name: 'Marc', stance: 'skeptic', trade: 'plumbing', who: 'runs five plumbers', usage: 'quotes on a phone' },
    { name: 'Julie', stance: 'fan', trade: 'roofing', who: 'office manager', usage: 'invoices weekly' },
  ],
  updatedAt: '2026-09-30T10:00:00Z',
});

const BREAK = {
  findings: [{ quote: 'designs for the CFO of a six-entity   HOLDING', claims: ['never#4', 'size#1'], why: 'A holding is a group.' }],
  persona: { name: 'marc', line: 'Six entities? I have one van and five plumbers.' },
};

/** A model that answers `reply` (run through the caller's check, as the kit's client does). */
const modelAnswering = (reply) =>
  vi.fn(async ({ check }) => {
    const out = check(reply);
    return out.errors.length === 0
      ? { ok: true, error: null, reply: out.reply, reason: null }
      : { ok: false, error: 'refused', reply: null, reason: `model reply invalid: ${out.errors.join('; ')}` };
  });

const canonWith = ({ business = BUSINESS, ask = modelAnswering({ findings: [], persona: { name: '', line: '' } }) } = {}) => {
  const readBusiness = vi.fn(async () => business);
  return { canon: createCanon({ readBusiness, ask }), readBusiness, ask };
};

describe('quoted — a quote is in the spec word for word, whitespace and case aside', () => {
  it('finds it across line breaks and case', () => {
    expect(quoted(SPEC, 'six-entity holding, WHO closes')).toBe(true);
  });

  it('refuses a paraphrase and an empty quote', () => {
    expect(quoted(SPEC, 'the CFO of a holding')).toBe(false);
    expect(quoted(SPEC, '  ')).toBe(false);
  });
});

describe('createCanon — the verdicts', () => {
  it('green: no break, "canon ✓ · N claims read"', async () => {
    const { canon, readBusiness } = canonWith();
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(readBusiness).toHaveBeenCalledWith('acme/widgets');
    expect(gate).toMatchObject({ name: 'canon', ok: true, neutral: false, reason: 'canon ✓ · 2 claims read' });
    expect(gate.canon).toMatchObject({ state: 'green', claimsRead: 2, findings: [] });
  });

  it('red: "canon ✗ N", each break with its claim, the quoted spec line and one persona line', async () => {
    const { canon } = canonWith({ ask: modelAnswering(BREAK) });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ name: 'canon', ok: false, neutral: false, title: 'canon ✗ 1', reason: 'canon ✗ 1' });
    expect(gate.canon.findings).toEqual([
      { quote: BREAK.findings[0].quote, claims: ['never#4', 'size#1'], why: 'A holding is a group.' },
    ]);
    expect(gate.canon.persona).toEqual({ name: 'Marc', line: 'Six entities? I have one van and five plumbers.' });
    const details = gate.details.join('\n');
    expect(details).toContain('never#4 "Never: build for groups of companies"');
    expect(details).toContain(`"${BREAK.findings[0].quote}"`);
    expect(details).toContain('Marc: "Six entities? I have one van and five plumbers."');
  });

  it('drops a finding whose quote is not word for word in the spec', async () => {
    const invented = { findings: [{ quote: 'built for multinational groups', claims: ['never#4'], why: 'made up' }], persona: BREAK.persona };
    const { canon } = canonWith({ ask: modelAnswering(invented) });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ ok: true, reason: 'canon ✓ · 2 claims read' });
    expect(gate.canon.findings).toEqual([]);
  });

  it('drops a claim id the business does not hold, and a finding left with none', async () => {
    const reply = {
      findings: [
        { quote: 'six-entity holding', claims: ['never#99'], why: 'unknown claim' },
        { quote: 'closes the books', claims: ['never#99', 'size#1'], why: 'too big' },
      ],
      persona: { name: 'Nobody', line: 'who?' },
    };
    const { canon } = canonWith({ ask: modelAnswering(reply) });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate.canon.findings).toEqual([{ quote: 'closes the books', claims: ['size#1'], why: 'too big' }]);
    expect(gate.canon.persona).toBeNull();
  });

  it.each([
    ['no business', { ...BUSINESS, state: 'none', business: null, claims: [], personas: [], updatedAt: null }, 'no business: no workspace tracking acme/widgets has one'],
    ['no product claims', { ...BUSINESS, state: 'none', claims: [] }, 'no confirmed claim for this repository\'s product'],
  ])('neutral for %s, with its line, and no model call', async (_, business, reason) => {
    const { canon, ask } = canonWith({ business });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ name: 'canon', ok: true, neutral: true, reason });
    expect(gate.canon.state).toBe('neutral');
    expect(ask).not.toHaveBeenCalled();
  });

  it('neutral when the business cannot be read at all', async () => {
    const canon = createCanon({ readBusiness: async () => null, ask: modelAnswering(BREAK) });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ neutral: true, reason: 'no business: the App cannot read businesses here' });
  });

  it('neutral when the business read fails', async () => {
    const canon = createCanon({ readBusiness: async () => { throw new Error('connection reset'); }, ask: modelAnswering(BREAK) });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ neutral: true, reason: 'no business: the read failed (connection reset)' });
  });

  it('neutral for no model key', async () => {
    const ask = vi.fn(async () => ({ ok: false, error: 'no-key', reply: null, reason: 'OPENROUTER_API_KEY is not set' }));
    const { canon } = canonWith({ ask });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: true, reason: 'model not configured (OPENROUTER_API_KEY is not set)' });
  });

  it('neutral for a model error', async () => {
    const ask = vi.fn(async () => ({ ok: false, error: 'unavailable', reply: null, reason: 'model unavailable (503)' }));
    const { canon } = canonWith({ ask });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: true, reason: 'model error: model unavailable (503)' });
  });

  it('neutral for a reply the check refuses', async () => {
    const { canon } = canonWith({ ask: modelAnswering({ findings: 'none' }) });
    const gate = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(gate.neutral).toBe(true);
    expect(gate.reason).toMatch(/^model error: model reply invalid/);
  });
});

describe('createCanon — one call, cached by the spec and the claims', () => {
  it('a re-run with the same spec and claims does not call the model again', async () => {
    const { canon, ask } = canonWith({ ask: modelAnswering(BREAK) });
    const first = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    const again = await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(again).toEqual(first);
  });

  it('a changed spec, or a later claims update, asks again', async () => {
    const business = { ...BUSINESS };
    const { canon, ask } = canonWith({ business, ask: modelAnswering(BREAK) });
    await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    await canon.grade({ repo: 'acme/widgets', spec: `${SPEC}\nOne more line.` });
    business.updatedAt = '2026-09-30T11:00:00Z';
    await canon.grade({ repo: 'acme/widgets', spec: SPEC });
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('a model error is not cached', async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'unavailable', reply: null, reason: 'model unavailable (503)' })
      .mockImplementation(modelAnswering(BREAK));
    const { canon } = canonWith({ ask });
    expect((await canon.grade({ repo: 'acme/widgets', spec: SPEC })).neutral).toBe(true);
    expect((await canon.grade({ repo: 'acme/widgets', spec: SPEC })).ok).toBe(false);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('sends the spec capped, with the claims and personas, in one call', async () => {
    const { canon, ask } = canonWith();
    const long = `${SPEC}\n${'x'.repeat(CANON_SPEC_LIMIT)}`;
    await canon.grade({ repo: 'acme/widgets', spec: long });
    expect(ask).toHaveBeenCalledTimes(1);
    const { user } = ask.mock.calls[0][0];
    expect(user).toContain('never#4: never — Never: build for groups of companies');
    expect(user).toContain('Marc');
    expect(user.length).toBeLessThan(CANON_SPEC_LIMIT + 2000);
  });
});
