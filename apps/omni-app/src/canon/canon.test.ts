// The canon gate (PRD 839) with a stubbed business and a stubbed model: nothing here calls Supabase or
// OpenRouter.
import { describe, expect, it, vi } from 'vitest';
import { type Ask, CANON_SPEC_LIMIT, createCanon, type Judge, type JudgeAnswer, quoted } from './canon.ts';
import type { Business, Constituents } from './schema.ts';

const SPEC = [
  '# Group consolidation',
  '',
  'The dashboard designs for the CFO of a six-entity holding,',
  'who closes the books of every company at once.',
].join('\n');

const BUSINESS: Business = Object.freeze({
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
const modelAnswering = (reply: unknown) =>
  vi.fn<Ask>(async ({ check }) => {
    const out = check(reply);
    return out.errors.length === 0
      ? { ok: true, error: null, reply: out.reply, reason: null }
      : { ok: false, error: 'refused', reply: null, reason: `model reply invalid: ${out.errors.join('; ')}` };
  });

const canonWith = ({ business = BUSINESS, ask = modelAnswering({ findings: [], persona: { name: '', line: '' } }) }: { business?: Business; ask?: Ask } = {}) => {
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
      { quote: BREAK.findings[0]!.quote, claims: ['never#4', 'size#1'], why: 'A holding is a group.' },
    ]);
    expect(gate.canon.persona).toEqual({ name: 'Marc', line: 'Six entities? I have one van and five plumbers.' });
    const details = gate.details.join('\n');
    expect(details).toContain('never#4 "Never: build for groups of companies"');
    expect(details).toContain(`"${BREAK.findings[0]!.quote}"`);
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

  it.each<[string, Business, string]>([
    ['no business', { ...BUSINESS, state: 'none', business: null, claims: [], personas: [], updatedAt: null }, 'no business: no workspace tracking acme/widgets has one'],
    ['no product claims', { ...BUSINESS, state: 'none', claims: [] }, 'no confirmed claim or constituent for this repository\'s product'],
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
    const business: Business = { ...BUSINESS };
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
    const { user } = vi.mocked(ask).mock.calls[0]![0];
    expect(user).toContain('never#4: never — Never: build for groups of companies');
    expect(user).toContain('Marc');
    expect(user.length).toBeLessThan(CANON_SPEC_LIMIT + 2000);
  });
});

// ── PRD 871: the constituents, judged through the `constituent-break` Jev decision ──

const API_SPEC = [
  '# Project list',
  '',
  "The list loads with fetch('/api/v1/projects') and shows each project's name.",
].join('\n');

const CONSTITUENTS: Constituents = Object.freeze({
  state: 'ok',
  product: { name: 'Vertuoza UX' },
  statement: { id: 'statement', text: 'The component workshop, shown with fixtures.' },
  never: [
    { id: 'never#1', text: 'Calls real Vertuoza data or real Vertuoza APIs' },
    { id: 'never#3', text: 'Holds business logic' },
  ],
  latestEventId: '41',
});

const NO_CONSTITUENTS: Constituents = Object.freeze({ ...CONSTITUENTS, state: 'none', statement: null, never: [], latestEventId: null });

const API_BREAK = {
  findings: [{ quote: "fetch('/api/v1/projects')", claims: ['never#1'], why: 'A real API call.' }],
  persona: { name: '', line: '' },
};

const NOTHING = { findings: [], persona: { name: '', line: '' } };

/** A judge answering as galaxy's route does: `{answer, confidence, decidedBy}`; `answer` null echoes today's. */
const judgeAnswering = (answer: string | null, confidence: number | null = null, decidedBy = 'old') =>
  vi.fn<Judge>(async ({ old }) => ({ ok: true, answer: answer ?? old, confidence, decidedBy, error: null, reason: null }));

const constituentCanon = ({
  business = { ...BUSINESS, claims: [], personas: [] },
  constituents = CONSTITUENTS,
  reply = API_BREAK,
  judge = judgeAnswering(null),
}: { business?: Business; constituents?: Constituents; reply?: unknown; judge?: ReturnType<typeof judgeAnswering> } = {}) => {
  const readBusiness = vi.fn(async () => business);
  const readConstituents = vi.fn(async () => constituents);
  const ask = modelAnswering(reply);
  return { canon: createCanon({ readBusiness, readConstituents, judge, ask }), readBusiness, readConstituents, judge, ask };
};

describe('createCanon — the constituents (PRD 871)', () => {
  it("Off: the judge answers today's verdict; red names the quote and never#1", async () => {
    const { canon, judge, readConstituents } = constituentCanon();
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC, ref: 'PRD 9' });
    expect(readConstituents).toHaveBeenCalledWith('acme/ux');
    expect(gate).toMatchObject({ ok: false, neutral: false, reason: 'canon ✗ 1' });
    expect(gate.canon.findings).toEqual([{ quote: "fetch('/api/v1/projects')", claims: ['never#1'], why: 'A real API call.' }]);
    expect(gate.details[0]).toBe(`never#1 "Calls real Vertuoza data or real Vertuoza APIs" — the spec: "fetch('/api/v1/projects')"`);
    expect(gate.canon.judge).toEqual({ decidedBy: 'old', confidence: null });
    const [call] = judge.mock.calls[0]!;
    expect(call).toMatchObject({ repo: 'acme/ux', old: 'true', ref: 'PRD 9' });
    expect(call.state).toEqual({
      spec: API_SPEC,
      statement: 'The component workshop, shown with fixtures.',
      never: [
        { id: 'never#1', text: 'Calls real Vertuoza data or real Vertuoza APIs' },
        { id: 'never#3', text: 'Holds business logic' },
      ],
      verdict: { broken: true, findings: [{ quote: "fetch('/api/v1/projects')", constituents: ['never#1'], why: 'A real API call.' }] },
    });
  });

  it('the model reads the Statement and the live Never lines by their ids', async () => {
    const { canon, ask } = constituentCanon();
    await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    const { user, system } = ask.mock.calls[0]![0];
    expect(user).toContain('statement: The component workshop, shown with fixtures.');
    expect(user).toContain('never#1: Calls real Vertuoza data or real Vertuoza APIs');
    expect(system).toContain('Statement');
  });

  it('a spec breaking nothing is green, and the judge is asked with today\'s "false"', async () => {
    const { canon, judge } = constituentCanon({ reply: NOTHING });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: false, reason: 'canon ✓ · 0 claims, 3 constituents read' });
    expect(judge.mock.calls[0]![0]).toMatchObject({ old: 'false' });
  });

  it("Shadow: the judge answers today's (Jev only logged), so the model decides", async () => {
    const { canon } = constituentCanon({ judge: judgeAnswering('true', null, 'old') });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate.ok).toBe(false);
    expect(gate.details.join('\n')).not.toContain('judged by Jev');
  });

  it('On, above the floor: Jev says not broken, so the constituent finding is dropped', async () => {
    const { canon } = constituentCanon({ judge: judgeAnswering('false', 0.91, 'jev') });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: false });
    expect(gate.canon.findings).toEqual([]);
    expect(gate.canon.judge).toEqual({ decidedBy: 'jev', confidence: 0.91 });
  });

  it('On, Jev says broken: red, with the judge named under the findings', async () => {
    const { canon } = constituentCanon({ judge: judgeAnswering('true', 0.82, 'jev') });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate.ok).toBe(false);
    expect(gate.details).toContain('judged by Jev (constituent-break, confidence 0.82)');
  });

  it('Jev saying broken with no quoted finding is not red: a finding needs a word-for-word quote', async () => {
    const { canon } = constituentCanon({ reply: NOTHING, judge: judgeAnswering('true', 0.9, 'jev') });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: false });
  });

  it("Jev saying not broken keeps a size claim's part of a finding", async () => {
    const reply = { findings: [{ quote: "fetch('/api/v1/projects')", claims: ['never#1', 'size#1'], why: 'both' }], persona: { name: '', line: '' } };
    const { canon } = constituentCanon({ business: BUSINESS, reply, judge: judgeAnswering('false', 0.95, 'jev') });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate.canon.findings).toEqual([{ quote: "fetch('/api/v1/projects')", claims: ['size#1'], why: 'both' }]);
  });

  it('drops a finding citing a removed line, and one without a word-for-word quote', async () => {
    const reply = {
      findings: [
        { quote: "fetch('/api/v1/projects')", claims: ['never#2'], why: 'never#2 was removed' },
        { quote: 'calls the real projects API', claims: ['never#1'], why: 'a paraphrase' },
      ],
      persona: { name: '', line: '' },
    };
    const { canon, judge } = constituentCanon({ reply });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: false });
    expect(judge.mock.calls[0]![0]).toMatchObject({ old: 'false' });
  });

  it('cites the Statement by its id', async () => {
    const reply = { findings: [{ quote: 'shows each project', claims: ['statement'], why: 'not a workshop' }], persona: { name: '', line: '' } };
    const { canon } = constituentCanon({ reply });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate.canon.findings[0]!.claims).toEqual(['statement']);
    expect(gate.details[0]).toContain('statement "The component workshop, shown with fixtures."');
  });

  it.each([
    ['a judge-route error', { ok: false, error: 'refused', reason: 'galaxy answered 500' }, 'judge error: galaxy answered 500'],
    ['a missing secret', { ok: false, error: 'no-secret', reason: 'CONSTITUENT_JUDGE_SECRET is not set' }, 'judge not configured (CONSTITUENT_JUDGE_SECRET is not set)'],
  ])('neutral, never red, on %s', async (_, answer, reason) => {
    const { canon } = constituentCanon({ judge: vi.fn<Judge>(async () => answer as JudgeAnswer) });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: true, reason });
  });

  it('neutral, never red, with no judge wired at all', async () => {
    const canon = createCanon({
      readBusiness: async () => ({ ...BUSINESS, claims: [] }),
      readConstituents: async () => CONSTITUENTS,
      ask: modelAnswering(API_BREAK),
    });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ ok: true, neutral: true, reason: 'judge not configured (no judge here)' });
  });

  it('neutral when the constituents read fails', async () => {
    const canon = createCanon({
      readBusiness: async () => BUSINESS,
      readConstituents: async () => { throw new Error('connection reset'); },
      judge: judgeAnswering(null),
      ask: modelAnswering(API_BREAK),
    });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ neutral: true, reason: 'no constituents: the read failed (connection reset)' });
  });

  it('neutral with neither a claim nor a constituent, asking nothing', async () => {
    const { canon, ask, judge } = constituentCanon({ constituents: NO_CONSTITUENTS });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate).toMatchObject({ neutral: true, reason: "no confirmed claim or constituent for this repository's product" });
    expect(ask).not.toHaveBeenCalled();
    expect(judge).not.toHaveBeenCalled();
  });

  it('with claims but no constituents, the judge is not asked', async () => {
    const { canon, judge } = constituentCanon({ business: BUSINESS, constituents: NO_CONSTITUENTS });
    const gate = await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(gate.neutral).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });

  it('a new constituent event re-judges a cached spec; the same one asks the model once', async () => {
    const constituents: Constituents = { ...CONSTITUENTS };
    const { canon, ask, judge } = constituentCanon({ constituents });
    await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(ask).toHaveBeenCalledTimes(1);
    constituents.latestEventId = '42';
    await canon.grade({ repo: 'acme/ux', spec: API_SPEC });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(judge).toHaveBeenCalledTimes(3);
  });
});
