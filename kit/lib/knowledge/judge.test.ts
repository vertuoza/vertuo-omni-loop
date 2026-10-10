import { describe, expect, it } from 'vitest';
import { parseIssue } from '../ids.ts';
import { makeMarkers } from '../markers.ts';
import {
  citationsOf,
  lawIssueOf,
  ledgerOf,
  pendLaw,
  prdOf,
  removeEntry,
  requireProofText,
  sweepEdits,
  sweepState,
  unenforcedLaws,
  worthPrompt,
  WorthReplySchema,
} from './judge.ts';
import { memorySource, readKnowledge } from './registers.ts';

const K = '.omni-loop/knowledge';
const LEDGER = '.omni-loop/delivery/shipped/42-widgets/outbox/settled.md';
const markers = makeMarkers('omni-outbox');

const RULES = [
  '# Product rules',
  '',
  '## BR-PRODUCT-1',
  '',
  'A widget is named before it is saved.',
  '',
  'Serves: P-PRODUCT-1',
  `Source: ${LEDGER}, entry s1-01-named, PRD #42`,
  'Enforced by: unenforced',
  '',
  '## BR-PRODUCT-2',
  '',
  'A widget is blue.',
  '',
  'Serves: P-PRODUCT-1',
  `Source: ${LEDGER}, entry s1-02-blue, PRD #42`,
  'Enforced by: unenforced',
  '',
  '## BR-PRODUCT-3',
  '',
  'A widget has a price.',
  '',
  'Serves: P-PRODUCT-1',
  'Enforced by: kit/lib/widgets.test.ts',
  '',
].join('\n');

const PRINCIPLES = ['# Product principles', '', '## P-PRODUCT-1', '', 'Widgets are simple.', '', 'Why: people use them.', ''].join('\n');
const INVARIANTS = ['# Product invariants', '', '## N-PRODUCT-1', '', 'A widget is blue, as BR-PRODUCT-2 says.', '', 'Enforced by: pending #7', ''].join('\n');

const LEDGER_TEXT = [
  '# Settled',
  '',
  markers.settledOpen('s1-02-blue'),
  '- Rank: medium',
  '- Became: BR-PRODUCT-2',
  '',
  'The item.',
  markers.settledClose('s1-02-blue'),
  '',
].join('\n');

const TEXTS: Record<string, string> = {
  [`${K}/product/principles.md`]: PRINCIPLES,
  [`${K}/product/rules.md`]: RULES,
  [`${K}/product/invariants.md`]: INVARIANTS,
};

const knowledge = () => readKnowledge({ ctx: { root: '/nowhere', layout: { knowledgeRoot: K } }, source: memorySource(TEXTS) });

describe('unenforcedLaws', () => {
  it('lists every rule and invariant whose Enforced by: is unenforced, and nothing else', () => {
    expect(unenforcedLaws(knowledge().entries).map((entry) => entry.id)).toEqual(['BR-PRODUCT-1', 'BR-PRODUCT-2']);
  });
});

describe('sweepState', () => {
  it('reads the five fields: the statement, its why, the principle it serves, its domain and the PRD title', () => {
    const { entries } = knowledge();
    const rule = entries.find((entry) => entry.id === 'BR-PRODUCT-1');
    expect(rule && sweepState(rule, entries, 'Widgets')).toEqual({
      statement: 'A widget is named before it is saved.',
      why: null,
      principle: 'P-PRODUCT-1: Widgets are simple.',
      domain: 'product',
      prdTitle: 'Widgets',
    });
  });

  it('keeps a served id it cannot find as it is, and none for an entry that serves nothing', () => {
    const { entries } = knowledge();
    const rule = entries.find((entry) => entry.id === 'BR-PRODUCT-1');
    const invariant = entries.find((entry) => entry.id === 'N-PRODUCT-1');
    expect(rule && sweepState(rule, [], null).principle).toBe('P-PRODUCT-1');
    expect(invariant && sweepState(invariant, entries, null).principle).toBeNull();
  });
});

describe('worthPrompt and WorthReplySchema', () => {
  it('asks the one question with the five fields', () => {
    const prompt = worthPrompt({ statement: 'A is B.', why: 'because', principle: 'P-X-1: simple', domain: 'product', prdTitle: 'Widgets' });
    expect(prompt).toContain('A is B.');
    expect(prompt).toContain('Why: because');
    expect(prompt).toContain('Principle it serves: P-X-1: simple');
    expect(prompt).toContain('Domain: product');
    expect(prompt).toContain('PRD: Widgets');
    expect(prompt).toContain('worthALaw');
  });

  it('says none for a field it lacks', () => {
    expect(worthPrompt({ statement: 'A is B.', why: null, principle: null, domain: null, prdTitle: null })).toContain('Why: none');
  });

  it('accepts a boolean and a reason, and refuses anything else', () => {
    expect(WorthReplySchema.safeParse({ worthALaw: true, reason: 'it matters' }).success).toBe(true);
    expect(WorthReplySchema.safeParse({ worthALaw: 'yes', reason: 'it matters' }).success).toBe(false);
    expect(WorthReplySchema.safeParse({ worthALaw: true }).success).toBe(false);
    expect(WorthReplySchema.safeParse({ worthALaw: true, reason: 'r', more: 1 }).success).toBe(false);
  });
});

describe('ledgerOf', () => {
  it('reads the ledger and its entry from a Source: line, with or without backticks', () => {
    expect(ledgerOf(`${LEDGER}, entry s1-02-blue, PRD #42`)).toEqual({ file: LEDGER, id: 's1-02-blue' });
    expect(ledgerOf(`\`${LEDGER}\`, entry \`s1-02-blue\``)).toEqual({ file: LEDGER, id: 's1-02-blue' });
  });

  it('is null for a source that names no ledger entry', () => {
    expect(ledgerOf('PRD #3')).toBeNull();
    expect(ledgerOf(null)).toBeNull();
  });
});

describe('prdOf', () => {
  it('reads the PRD a source names, and none otherwise', () => {
    expect(prdOf(`${LEDGER}, entry s1-02-blue, PRD #42`)).toBe(42);
    expect(prdOf('PRD #3')).toBe(3);
    expect(prdOf('a page')).toBeNull();
    expect(prdOf(null)).toBeNull();
  });
});

describe('lawIssueOf', () => {
  it('titles the issue Law: <statement> and names the entry, its register and its source', () => {
    const rule = knowledge().entries.find((entry) => entry.id === 'BR-PRODUCT-1');
    const issue = rule && lawIssueOf(rule);
    expect(issue?.title).toBe('Law: A widget is named before it is saved.');
    expect(issue?.body).toContain('`BR-PRODUCT-1`');
    expect(issue?.body).toContain(`\`${K}/product/rules.md\``);
    expect(issue?.body).toContain(`Source: ${LEDGER}, entry s1-01-named, PRD #42`);
    expect(issue?.body).toContain('omni knowledge judge');
  });

  it('says none for an entry without a source', () => {
    const invariant = knowledge().entries.find((entry) => entry.id === 'N-PRODUCT-1');
    expect(invariant && lawIssueOf(invariant).body).toContain('Source: none');
  });
});

describe('pendLaw and removeEntry', () => {
  it('rewrites only that entry\'s Enforced by: unenforced to pending #<n>', () => {
    const text = pendLaw(RULES, 'BR-PRODUCT-2', parseIssue(91));
    expect(text.match(/Enforced by: pending #91/g)).toHaveLength(1);
    expect(text.indexOf('pending #91')).toBeGreaterThan(text.indexOf('## BR-PRODUCT-2'));
    expect(text.match(/Enforced by: unenforced/g)).toHaveLength(1);
  });

  it('changes nothing for an entry it does not hold, or one already enforced', () => {
    expect(pendLaw(RULES, 'BR-PRODUCT-9', parseIssue(91))).toBe(RULES);
    expect(pendLaw(RULES, 'BR-PRODUCT-3', parseIssue(91))).toBe(RULES);
  });

  it('removes one entry, from its heading to the next, and leaves one blank line between the rest', () => {
    const text = removeEntry(RULES, 'BR-PRODUCT-2');
    expect(text).not.toContain('BR-PRODUCT-2');
    expect(text).not.toContain('A widget is blue.');
    expect(text).toContain('Enforced by: unenforced\n\n## BR-PRODUCT-3\n');
    expect(text).not.toContain('\n\n\n');
  });

  it('removes the last entry of a file, ending it with one newline', () => {
    const text = removeEntry(RULES, 'BR-PRODUCT-3');
    expect(text.endsWith('Enforced by: unenforced\n')).toBe(true);
    expect(removeEntry(RULES, 'BR-PRODUCT-9')).toBe(RULES);
  });
});

describe('citationsOf', () => {
  it('names each entry, or file, that still cites a removed id', () => {
    const files = [
      { path: `${K}/product/invariants.md`, text: INVARIANTS },
      { path: `${K}/README.md`, text: '# Knowledge\n\nSee BR-PRODUCT-2.\n' },
      { path: `${K}/product/rules.md`, text: removeEntry(RULES, 'BR-PRODUCT-2') },
    ];
    expect(citationsOf(files, ['BR-PRODUCT-2'])).toEqual([
      { id: 'BR-PRODUCT-2', citedBy: 'N-PRODUCT-1', file: `${K}/product/invariants.md` },
      { id: 'BR-PRODUCT-2', citedBy: null, file: `${K}/README.md` },
    ]);
    expect(citationsOf(files, [])).toEqual([]);
  });
});

describe('requireProofText', () => {
  it('adds requireProof: true under laws:, at its children\'s indent', () => {
    expect(requireProofText('kit: 1\nlaws:\n    source: knowledge\nask:\n  url: x\n')).toBe('kit: 1\nlaws:\n    requireProof: true\n    source: knowledge\nask:\n  url: x\n');
  });

  it('turns an existing requireProof to true, keeping its comment', () => {
    expect(requireProofText('laws:\n  source: knowledge\n  requireProof: false # later\n')).toBe('laws:\n  source: knowledge\n  requireProof: true # later\n');
  });

  it('changes nothing when it is true already', () => {
    const text = 'laws:\n  source: knowledge\n  requireProof: true\n';
    expect(requireProofText(text)).toBe(text);
  });

  it('is null when laws: is not a block it can edit', () => {
    expect(requireProofText('laws: { source: knowledge }\n')).toBeNull();
    expect(requireProofText('kit: 1\n')).toBeNull();
  });
});

describe('sweepEdits', () => {
  const read = (path: string) => (path === LEDGER ? LEDGER_TEXT : (TEXTS[path] ?? null));
  const yes = { worth: { worth: true, decidedBy: 'classifier', confidence: null }, issue: parseIssue(91) };
  const no = { worth: { worth: false, decidedBy: 'Jev', confidence: 0.77 }, issue: null };
  const sweep = (verdicts: Parameters<typeof sweepEdits>[0]['verdicts'], config: string | null = 'laws:\n  source: knowledge\n') =>
    sweepEdits({ entries: knowledge().entries, read, verdicts, markers, knowledgeFiles: Object.keys(TEXTS), config: config === null ? null : { file: '.omni-loop/config.yml', text: config } });

  it('pends a "yes", removes a "no" into its ledger, sets requireProof and reports what cited it', () => {
    const result = sweep({ 'BR-PRODUCT-1': yes, 'BR-PRODUCT-2': no });
    const written = Object.fromEntries(result.writes.map((write) => [write.path, write.text]));
    expect(Object.keys(written).sort()).toEqual(['.omni-loop/config.yml', `${K}/product/rules.md`, LEDGER].sort());
    expect(written[`${K}/product/rules.md`]).toContain('## BR-PRODUCT-1\n\nA widget is named before it is saved.\n\nServes: P-PRODUCT-1');
    expect(written[`${K}/product/rules.md`]).toContain('Enforced by: pending #91');
    expect(written[`${K}/product/rules.md`]).not.toContain('BR-PRODUCT-2');
    expect(written[LEDGER]).toContain('- Became: BR-PRODUCT-2\n- Stays here: not worth a law (Jev 0.77), was BR-PRODUCT-2\n');
    expect(written['.omni-loop/config.yml']).toBe('laws:\n  requireProof: true\n  source: knowledge\n');
    expect(result.removed).toEqual([{ id: 'BR-PRODUCT-2', ledger: LEDGER }]);
    expect(result.citations).toEqual([{ id: 'BR-PRODUCT-2', citedBy: 'N-PRODUCT-1', file: `${K}/product/invariants.md` }]);
    expect(result.requireProof).toBe('set');
  });

  it('removes a "no" whose source names no ledger it can write, saying so', () => {
    const noLedger = sweepEdits({
      entries: knowledge().entries,
      read: (path) => TEXTS[path] ?? null,
      verdicts: { 'BR-PRODUCT-1': no },
      markers,
      knowledgeFiles: Object.keys(TEXTS),
      config: null,
    });
    expect(noLedger.removed).toEqual([{ id: 'BR-PRODUCT-1', ledger: null }]);
    expect(noLedger.writes.map((write) => write.path)).toEqual([`${K}/product/rules.md`]);
    expect(noLedger.requireProof).toBe('unreadable');
  });

  it('leaves requireProof alone while a law is undecided, and writes nothing for a "yes" with no issue', () => {
    const result = sweep({ 'BR-PRODUCT-1': { ...yes, issue: null } });
    expect(result.writes).toEqual([]);
    expect(result.requireProof).toBe('undecided');
  });

  it('writes nothing when every law was swept and requireProof is already true', () => {
    const swept = sweepEdits({
      entries: [],
      read,
      verdicts: {},
      markers,
      knowledgeFiles: [],
      config: { file: '.omni-loop/config.yml', text: 'laws:\n  source: knowledge\n  requireProof: true\n' },
    });
    expect(swept.writes).toEqual([]);
    expect(swept.requireProof).toBe('already');
  });
});
