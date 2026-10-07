import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { makeMarkers } from '../markers.ts';
import { parseOutboxItem } from '../outbox/outbox.ts';
import { renderSettledEntry, settledHeader } from '../outbox/settle.ts';
import {
  CAPS,
  CLASSIFICATION_KINDS,
  ClassificationSchema,
  allowedKinds,
  classificationJsonSchema,
  classificationPrompt,
  classificationSchema,
  knowledgeSummary,
} from './classify.ts';
import { candidatesFromLedger } from './harvest.ts';
import { LOOK_RULE } from './look-rule.ts';
import { assertDefined } from '../../test/assert.ts';
import { parsePrd } from '../ids.ts';

/** The fixture's parsed item: every fixture here parses, so a miss is a broken fixture. */
function itemOf(text: string) {
  const parsed = parseOutboxItem(text);
  if (!parsed.ok) throw new Error('fixture outbox item does not parse');
  return parsed.item;
}

const K = '.omni-loop/knowledge';

const KNOWLEDGE_FILES = {
  [`${K}/README.md`]: '# Knowledge\n',
  [`${K}/product/principles.md`]: [
    '# Product principles',
    '',
    '## P-PRODUCT-1',
    '',
    'A person reviews every change before it reaches the default branch.',
    '',
    'Why: nothing merges unseen.',
    'Decided: @ada, 2026-09-01',
    'Source: spec.md',
    '',
  ].join('\n'),
  [`${K}/product/rules.md`]: [
    '# Product rules',
    '',
    '## BR-PRODUCT-1',
    '',
    'No bot writes to the default branch.',
    '',
    'Serves: P-PRODUCT-1',
    'Source: spec.md',
    'Enforced by: unenforced',
    'Stated: 2026-09-01',
    '',
  ].join('\n'),
  [`${K}/product/invariants.md`]: '# Product invariants\n\nNone yet.\n',
  [`${K}/domains/billing/README.md`]: '# Billing\n\nInvoices and credits.\n',
  [`${K}/domains/billing/principles.md`]: [
    '# Billing principles',
    '',
    '## P-BILLING-1',
    '',
    'An invoice is never changed once sent.',
    '',
    'Why: customers keep what they received.',
    'Decided: @ada, 2026-09-01',
    'Source: spec.md',
    '',
  ].join('\n'),
  [`${K}/domains/billing/invariants.md`]: [
    '# Billing invariants',
    '',
    '## N-BILLING-1',
    '',
    'Every invoice carries a number.',
    '',
    'Source: spec.md',
    'Enforced by: unenforced',
    'Stated: 2026-09-01',
    '',
  ].join('\n'),
  [`${K}/domains/shipping/README.md`]: '\n# Shipping\n',
  [`${K}/adr/README.md`]: '# Decisions\n',
  [`${K}/adr/0001-outbox-check-as-app.md`]: '# ADR-0001 — The outbox check runs as an app\n\nBody.\n',
};

function summaryOf(files: Record<string, string> = KNOWLEDGE_FILES) {
  const { ctx } = makeRepo({ files });
  return knowledgeSummary({ ctx });
}

const SUMMARY = summaryOf();

const ITEM_TEXT = [
  '---',
  'id: s1-01-two-snapshots',
  'prd: 28',
  'slice: s1',
  'rank: medium',
  'bears-on: none',
  'raised: 2026-09-20',
  'wave: 1',
  '---',
  '',
  '## The question, in plain words',
  '',
  'Should the check read its settings from the pull request itself?',
  '',
  '## The decision, in plain words',
  '',
  'It reads its settings from the base branch, so a pull request cannot rename the override label.',
  '',
  '## The options, in plain words',
  '',
  'A. Read the settings from the base branch, the option built.',
  'B. Read them from the pull request.',
  '',
  '## What I had to decide',
  '',
  'Where `evaluate` reads the config from.',
  '',
  '## What I did meanwhile',
  '',
  'It reads base settings and head delivery as two snapshots.',
  '',
  '## What it costs to change later',
  '',
  'One argument.',
  '',
  '## What I could not know',
  '',
  '(author) Nothing settles it.',
  '',
].join('\n');

function candidate() {
  const markers = makeMarkers('omni-outbox');
  const item = itemOf(ITEM_TEXT);
  const entry = renderSettledEntry({
    item,
    itemText: ITEM_TEXT,
    answer: {
      text: 'Yes, keep it.',
      approvedBy: '@ada',
      approvedAt: '2026-09-22',
      channel: { kind: 'prd-issue', number: 28 },
    },
    judgement: { verdict: 'agreed', basis: 'affirmation', reason: 'yes' },
    markers,
  });
  const ctx = { config: { paths: { delivery: '.omni-loop/delivery' } } };
  const text = `${settledHeader(parsePrd(28), { ctx })}\n${entry}`;
  const [candidate] = candidatesFromLedger(text, { markers, ledgerFile: 'shipped/0028/outbox/settled.md' });
  assertDefined(candidate, 'the candidate');
  return candidate;
}

describe('knowledgeSummary', () => {
  it('reads the domains, principles, records and laws, and which places exist', () => {
    expect(SUMMARY).toEqual({
      places: { adr: true, knowledge: true },
      domains: [
        { name: 'billing', firstLine: '# Billing' },
        { name: 'shipping', firstLine: '# Shipping' },
      ],
      principles: [
        { id: 'P-PRODUCT-1', place: 'product', statement: 'A person reviews every change before it reaches the default branch.' },
        { id: 'P-BILLING-1', place: 'billing', statement: 'An invoice is never changed once sent.' },
      ],
      decisions: [{ number: '0001', title: 'ADR-0001 — The outbox check runs as an app' }],
      laws: [
        { id: 'BR-PRODUCT-1', kind: 'rule', place: 'product', statement: 'No bot writes to the default branch.' },
        { id: 'N-BILLING-1', kind: 'invariant', place: 'billing', statement: 'Every invoice carries a number.' },
      ],
    });
  });

  it('reads a repository with no knowledge folder as having no place for records, rules or invariants', () => {
    const summary = summaryOf({ 'README.md': '# x\n' });
    expect(summary.places).toEqual({ adr: false, knowledge: false });
    expect(allowedKinds(summary.places)).toEqual(['covered', 'stays-here']);
  });
});

describe('classificationPrompt', () => {
  it('carries the item sections, the answer and verdict, and the knowledge base summary', () => {
    const prompt = classificationPrompt({ candidate: candidate(), summary: SUMMARY });
    for (const expected of [
      'Should the check read its settings from the pull request itself?',
      'It reads its settings from the base branch, so a pull request cannot rename the override label.',
      'A. Read the settings from the base branch, the option built.',
      'Where `evaluate` reads the config from.',
      'It reads base settings and head delivery as two snapshots.',
      'One argument.',
      '### The answer (verdict: agreed)',
      'Yes, keep it.',
      '- billing: # Billing',
      '- P-PRODUCT-1 (product): A person reviews',
      '- P-BILLING-1 (billing): An invoice',
      '- ADR-0001: ADR-0001 — The outbox check runs as an app',
      '- BR-PRODUCT-1 (rule, product): No bot writes',
      '- N-BILLING-1 (invariant, billing): Every invoice',
    ]) {
      expect(prompt).toContain(expected);
    }
  });

  it('quotes the look rule word for word', () => {
    expect(classificationPrompt({ candidate: candidate(), summary: SUMMARY })).toContain(LOOK_RULE);
  });

  it('is pinned by a snapshot', async () => {
    await expect(classificationPrompt({ candidate: candidate(), summary: SUMMARY })).toMatchFileSnapshot(
      './classify.prompt.snap',
    );
  });

  it('offers only the kinds the repository has a place for', () => {
    const summary = { ...SUMMARY, places: { adr: false, knowledge: true } };
    const prompt = classificationPrompt({ candidate: candidate(), summary });
    expect(prompt).not.toContain('- `adr`');
    expect(prompt).toContain('- `rule`');
  });
});

describe('classificationSchema', () => {
  const schema = classificationSchema(SUMMARY);
  const accepts = (reply: unknown) => schema.safeParse(reply).success;
  const refusal = (reply: unknown, bound = schema) => {
    const result = bound.safeParse(reply);
    expect(result.success).toBe(false);
    assertDefined(result.error, 'result.error');
    return result.error.issues.map((issue) => issue.message).join(' | ');
  };
  const long = (n: number) => 'x'.repeat(n + 1);

  const VALID = {
    adr: { kind: 'adr', title: 'The check reads two snapshots', statement: 'Settings come from the base.', reason: 'how it is built' },
    invariant: { kind: 'invariant', place: 'billing', statement: 'An invoice number is unique.', reason: 'must always hold' },
    ruleExisting: { kind: 'rule', place: 'product', statement: 'A merge adopts what is open.', serves: 'P-PRODUCT-1', reason: 'provable' },
    ruleOwnDomain: { kind: 'rule', place: 'billing', statement: 'A credit note cites its invoice.', serves: 'P-BILLING-1', reason: 'provable' },
    ruleNew: {
      kind: 'rule',
      place: 'shipping',
      statement: 'A parcel has one label.',
      serves: 'new',
      principle: { statement: 'A parcel is traceable.', why: 'customers ask where it is' },
      reason: 'no principle fits',
    },
    coveredEntry: { kind: 'covered', covers: 'BR-PRODUCT-1', reason: 'already said' },
    coveredRecord: { kind: 'covered', covers: 'ADR-0001', reason: 'already recorded' },
    staysHere: { kind: 'stays-here', statement: 'A local naming choice.', reason: 'nothing lasting' },
  };

  it.each(Object.entries(VALID))('accepts a valid %s', (_, reply) => {
    expect(accepts(reply)).toBe(true);
  });

  it('refuses an unknown kind', () => {
    expect(refusal({ kind: 'principle', statement: 's', reason: 'r' })).toMatch(/kind must be one of/);
  });

  it('refuses a place naming no existing domain', () => {
    expect(refusal({ ...VALID.invariant, place: 'payroll' })).toMatch(/place "payroll" is not "product" nor an existing domain/);
  });

  it('refuses a rule with no serves', () => {
    const reply: Record<string, unknown> = { ...VALID.ruleExisting };
    delete reply.serves;
    expect(refusal(reply)).toMatch(/serves is required/);
  });

  it('refuses serves: new without a principle, and a principle without serves: new', () => {
    const noPrinciple: Record<string, unknown> = { ...VALID.ruleNew };
    delete noPrinciple.principle;
    expect(refusal(noPrinciple)).toMatch(/needs the principle it proposes/);
    expect(refusal({ ...VALID.ruleExisting, principle: VALID.ruleNew.principle })).toMatch(/only with serves "new"/);
  });

  it('refuses a rule serving no existing principle, or another domain principle', () => {
    expect(refusal({ ...VALID.ruleExisting, serves: 'P-PRODUCT-9' })).toMatch(/no existing principle/);
    expect(refusal({ ...VALID.ruleExisting, place: 'shipping', serves: 'P-BILLING-1' })).toMatch(/a principle of "billing"/);
  });

  it('refuses a statement, a principle field or a reason over its cap', () => {
    expect(refusal({ ...VALID.staysHere, statement: long(CAPS.statement) })).toMatch(/statement is over its cap of 300/);
    expect(refusal({ ...VALID.staysHere, reason: long(CAPS.reason) })).toMatch(/reason is over its cap of 200/);
    expect(refusal({ ...VALID.ruleNew, principle: { statement: long(CAPS.principle), why: 'w' } })).toMatch(/principle\.statement is over its cap/);
    expect(refusal({ ...VALID.ruleNew, principle: { statement: 's', why: long(CAPS.principle) } })).toMatch(/principle\.why is over its cap/);
    expect(accepts({ ...VALID.staysHere, statement: 'x'.repeat(CAPS.statement) })).toBe(true);
  });

  it('refuses covers naming nothing', () => {
    expect(refusal({ ...VALID.coveredEntry, covers: 'BR-PRODUCT-7' })).toMatch(/names no existing entry or decision record/);
    expect(refusal({ ...VALID.coveredEntry, covers: 'ADR-0009' })).toMatch(/names no existing entry or decision record/);
    expect(refusal({ ...VALID.coveredEntry, covers: 'anything' })).toMatch(/names no existing entry/);
  });

  it('refuses adr with no decision-record folder', () => {
    const bound = classificationSchema({ ...SUMMARY, places: { adr: false, knowledge: true } });
    expect(refusal(VALID.adr, bound)).toMatch(/kind "adr" has no place here: this repository has no decision-record folder/);
  });

  it('refuses rule or invariant with no knowledge folder', () => {
    const bound = classificationSchema(summaryOf({ 'README.md': '# x\n' }));
    expect(refusal(VALID.ruleExisting, bound)).toMatch(/kind "rule" has no place here: this repository has no knowledge folder/);
    expect(refusal(VALID.invariant, bound)).toMatch(/kind "invariant" has no place here/);
    expect(bound.safeParse(VALID.staysHere).success).toBe(true);
  });

  it('refuses a field the kind does not carry, and one it misses', () => {
    expect(refusal({ ...VALID.coveredEntry, statement: 'extra' })).toMatch(/Unrecognized key/);
    expect(refusal({ ...VALID.staysHere, place: 'product' })).toMatch(/Unrecognized key/);
    const noTitle: Record<string, unknown> = { ...VALID.adr };
    delete noTitle.title;
    expect(refusal(noTitle)).toMatch(/title is required/);
    const noReason: Record<string, unknown> = { ...VALID.staysHere };
    delete noReason.reason;
    expect(refusal(noReason)).toMatch(/reason is required/);
  });

  it('the context-free shape accepts any place and any principle', () => {
    expect(ClassificationSchema.safeParse({ ...VALID.invariant, place: 'payroll' }).success).toBe(true);
  });
});

describe('classificationJsonSchema', () => {
  it('lists the allowed kinds and the existing places', () => {
    const json = classificationJsonSchema(SUMMARY);
    expect(json.properties.kind.enum).toEqual(CLASSIFICATION_KINDS);
    expect(json.properties.place.enum).toEqual(['product', 'billing', 'shipping']);
    expect(json.required).toEqual(['kind', 'reason']);
  });
});

describe('enforcedBy — the proof a rule or an invariant proposes (PRD 1171)', () => {
  const schema = classificationSchema(SUMMARY);
  const RULE = { kind: 'rule', place: 'product', statement: 'A merge adopts what is open.', serves: 'P-PRODUCT-1', reason: 'provable' };
  const INVARIANT = { kind: 'invariant', place: 'billing', statement: 'An invoice number is unique.', reason: 'must always hold' };
  const messages = (reply: unknown) => {
    const result = schema.safeParse(reply);
    expect(result.success).toBe(false);
    assertDefined(result.error, 'result.error');
    return result.error.issues.map((issue) => issue.message).join(' | ');
  };

  it('is accepted on a rule and an invariant, one to three paths', () => {
    expect(schema.safeParse({ ...RULE, enforcedBy: ['kit/lib/foo.test.ts'] }).success).toBe(true);
    expect(schema.safeParse({ ...INVARIANT, enforcedBy: ['a.test.ts', 'b.test.ts', 'c.sql'] }).success).toBe(true);
    expect(schema.safeParse(RULE).success).toBe(true);
  });

  it('is refused on adr, covered and stays-here', () => {
    const others = [
      { kind: 'adr', title: 'The check reads two snapshots', statement: 'Settings come from the base.', reason: 'how it is built' },
      { kind: 'covered', covers: 'ADR-0001', reason: 'already recorded' },
      { kind: 'stays-here', statement: 'A local naming choice.', reason: 'nothing lasting' },
    ];
    for (const reply of others) expect(messages({ ...reply, enforcedBy: ['a.test.ts'] })).toMatch(/Unrecognized key/);
  });

  it('refuses no path, more than three, and an empty one', () => {
    expect(messages({ ...RULE, enforcedBy: [] })).toMatch(/enforcedBy/);
    expect(messages({ ...RULE, enforcedBy: ['a', 'b', 'c', 'd'] })).toMatch(/enforcedBy/);
    expect(messages({ ...INVARIANT, enforcedBy: ['  '] })).toMatch(/enforcedBy/);
  });

  it('the prompt lists the changed paths and says when to omit the field', () => {
    const prompt = classificationPrompt({ candidate: candidate(), summary: SUMMARY, changed: ['kit/lib/foo.test.ts', 'kit/lib/foo.ts'] });
    expect(prompt).toContain('## The files the feature pull request changed\n\n- kit/lib/foo.test.ts\n- kit/lib/foo.ts\n');
    expect(prompt).toContain('`enforcedBy`');
    expect(prompt).toMatch(/omit `enforcedBy` when none of them proves the statement/i);
    expect(classificationPrompt({ candidate: candidate(), summary: SUMMARY })).toContain(
      '## The files the feature pull request changed\n\n(none)\n',
    );
  });

  it('the JSON schema offers enforcedBy as up to three paths', () => {
    expect(classificationJsonSchema(SUMMARY).properties.enforcedBy).toEqual({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 3,
    });
  });
});
