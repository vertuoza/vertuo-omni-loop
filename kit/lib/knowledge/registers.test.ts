// @ts-nocheck
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.ts';
import { gradeKnowledge } from './check-knowledge.ts';
import {
  codeOf,
  diskSource,
  idParts,
  idsCitedIn,
  memorySource,
  parseEntryFile,
  readKnowledge,
} from './registers.ts';

const DOMAIN_RULES = { scope: 'domain', domain: 'advisor', codes: ['ADVISOR'], kind: 'rule' };

describe('codeOf — a domain code is its folder name uppercased, hyphens removed', () => {
  it('reads agent-session as AGENTSESSION and erp as ERP', () => {
    expect(codeOf('agent-session')).toBe('AGENTSESSION');
    expect(codeOf('micro-feedback')).toBe('MICROFEEDBACK');
    expect(codeOf('erp')).toBe('ERP');
  });
});

describe('idParts — every id shape splits one way', () => {
  it('splits a principle, a rule, a domain invariant and a cross-domain id', () => {
    expect(idParts('P-ADVISOR-1')).toEqual({ type: 'P', codes: ['ADVISOR'], n: '1' });
    expect(idParts('BR-ERPWRITE-12')).toEqual({ type: 'BR', codes: ['ERPWRITE'], n: '12' });
    expect(idParts('N-AGENTSESSION-3')).toEqual({ type: 'N', codes: ['AGENTSESSION'], n: '3' });
    expect(idParts('X-ADVISOR-CREDITS-1')).toEqual({
      type: 'X',
      codes: ['ADVISOR', 'CREDITS'],
      n: '1',
    });
  });

  it('reads N1…N8 as Core Invariants, carrying no code', () => {
    expect(idParts('N8')).toEqual({ type: 'CORE', codes: [], n: '8' });
  });

  it('reads anything else as no id at all', () => {
    expect(idParts('ADR-0069')).toBeNull();
    expect(idParts('P-ADVISOR')).toBeNull();
  });
});

describe('idsCitedIn', () => {
  it('finds every id shape, deduped', () => {
    expect(
      idsCitedIn(
        'see N2 and N2 again, BR-QUOTE-1, P-ADVISOR-2, N-FOLDER-1 and X-ADVISOR-CREDITS-1',
      ),
    ).toEqual(['N2', 'BR-QUOTE-1', 'P-ADVISOR-2', 'N-FOLDER-1', 'X-ADVISOR-CREDITS-1']);
  });

  it('finds nothing in prose with no id-shaped token, nor in a placeholder like P-ADVISOR-<n>', () => {
    expect(idsCitedIn('nothing to see here, ids are P-ADVISOR-<n>')).toEqual([]);
  });
});

describe('parseEntryFile', () => {
  it('reads a rule: statement, Serves, Source, Enforced by, Stated', () => {
    const text = [
      '# Advisor — rules',
      '',
      '## BR-ADVISOR-1',
      '',
      'The advisor drafts; a person saves.',
      '',
      'Serves: P-ADVISOR-1',
      'Source: docs/adr/0018-intent-execution-per-attempt-immutable.md',
      'Enforced by: unenforced',
      'Stated: 2026-09-24',
    ].join('\n');

    const [rule] = parseEntryFile('docs/knowledge/domains/advisor/rules.md', text, DOMAIN_RULES);
    expect(rule).toMatchObject({
      id: 'BR-ADVISOR-1',
      kind: 'rule',
      scope: 'domain',
      domain: 'advisor',
      statement: 'The advisor drafts; a person saves.',
      serves: 'P-ADVISOR-1',
      source: 'docs/adr/0018-intent-execution-per-attempt-immutable.md',
      enforcedBy: 'unenforced',
      enforced: false,
      stated: '2026-09-24',
      keptId: null,
    });
  });

  it('reads a principle whose Why: runs over two lines', () => {
    const text = [
      '## P-ADVISOR-1',
      '',
      'The advisor drafts; a person saves.',
      '',
      "Why: the product's promise is serenity — a customer's data changes only when one of their",
      'people says so.',
      'Decided: recorded in docs/orientation/mission-and-goals.md, 2026-09-10',
      'Source: docs/orientation/mission-and-goals.md',
    ].join('\n');
    const [principle] = parseEntryFile('p.md', text, { ...DOMAIN_RULES, kind: 'principle' });
    expect(principle.why).toBe(
      "the product's promise is serenity — a customer's data changes only when one of their people says so.",
    );
    expect(principle.enforcedBy).toBeNull();
  });

  it('ignores prose after the fields when building the statement, and a non-id heading ends an entry', () => {
    const text = [
      '## N1',
      '',
      'Data shapes are Zod-first.',
      '',
      'Enforced by: scripts/check-zod-first.mjs',
      '',
      'Note: narrowly — see the file for the gap.',
      '',
      '## Handed on',
      '',
      'Serves: P-NOTHING-1',
    ].join('\n');
    const entries = parseEntryFile('i.md', text, { ...DOMAIN_RULES, kind: 'invariant' });
    expect(entries).toHaveLength(1);
    expect(entries[0].statement).toBe('Data shapes are Zod-first.');
    expect(entries[0].enforced).toBe(true);
    expect(entries[0].serves).toBeNull();
  });

  it("takes a cross-domain entry's kind from its Kind: line", () => {
    const text = [
      '## X-ADVISOR-CREDITS-1',
      '',
      'A turn is charged before it runs.',
      '',
      'Kind: rule',
    ].join('\n');
    const [entry] = parseEntryFile('x.md', text, {
      scope: 'cross-domain',
      domain: 'advisor--credits',
      codes: ['ADVISOR', 'CREDITS'],
      kind: null,
    });
    expect(entry.kind).toBe('rule');
  });

  it('counts a repeated field line, so the guard can refuse a second Serves:', () => {
    const text = ['## BR-ADVISOR-1', 'x', '', 'Serves: P-ADVISOR-1', 'Serves: P-ADVISOR-2'].join(
      '\n',
    );
    const [rule] = parseEntryFile('r.md', text, DOMAIN_RULES);
    expect(rule.serves).toBe('P-ADVISOR-1');
    expect(rule.fieldCounts.serves).toBe(2);
  });
});

const roots = [];
afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'registers-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe('readKnowledge — a fixture tree', () => {
  it('reads an absent knowledge folder as empty', () => {
    const root = tree({});
    expect(readKnowledge({ ctx: flatCtx(root) })).toEqual({
      entries: [],
      domains: [],
      crossDomainFiles: [],
      productFiles: [],
    });
  });

  it('reads the domains, their glossary term, and a cross-domain pair', () => {
    const root = tree({
      'docs/knowledge/domains/agent-session/README.md': '# x\n\nGlossary term: Session\n',
      'docs/knowledge/domains/agent-session/rules.md':
        '## BR-AGENTSESSION-1\n\nx\n\nServes: P-PRODUCT-1\n',
      'docs/knowledge/cross-domain/advisor--credits.md':
        '## X-ADVISOR-CREDITS-1\n\nx\n\nKind: rule\n',
    });
    const knowledge = readKnowledge({ ctx: flatCtx(root) });
    expect(knowledge.domains).toEqual([
      {
        name: 'agent-session',
        code: 'AGENTSESSION',
        files: ['README.md', 'rules.md'],
        glossaryTerm: 'Session',
      },
    ]);
    expect(knowledge.crossDomainFiles).toEqual([
      {
        file: 'docs/knowledge/cross-domain/advisor--credits.md',
        name: 'advisor--credits',
        pair: ['advisor', 'credits'],
      },
    ]);
    expect(knowledge.entries.map((entry) => [entry.id, entry.kind, entry.codes])).toEqual([
      ['BR-AGENTSESSION-1', 'rule', ['AGENTSESSION']],
      ['X-ADVISOR-CREDITS-1', 'rule', ['ADVISOR', 'CREDITS']],
    ]);
  });

  it('reads the same folder from memory as off disk', () => {
    const files = {
      'docs/knowledge/README.md': '# Knowledge\n',
      'docs/knowledge/product/principles.md': '## P-PRODUCT-1\n\nx\n\nWhy: y\n',
      'docs/knowledge/product/notes.txt': 'not a register',
      'docs/knowledge/domains/agent-session/README.md': '# x\n\nGlossary term: Session\n',
      'docs/knowledge/domains/agent-session/rules.md': '## BR-AGENTSESSION-1\n\nx\n\nServes: P-PRODUCT-1\n',
      'docs/knowledge/domains/erp/invariants.md': '## N-ERP-1\n\nx\n',
      'docs/knowledge/cross-domain/advisor--credits.md': '## X-ADVISOR-CREDITS-1\n\nx\n\nKind: rule\n',
      'docs/knowledge/cross-domain/notes.txt': 'not a register',
    };
    const ctx = flatCtx(tree(files));
    expect(readKnowledge({ ctx, source: memorySource(files) })).toEqual(readKnowledge({ ctx }));
    expect(readKnowledge({ ctx, source: memorySource(files) }).domains.map((d) => d.name)).toEqual(['agent-session', 'erp']);
  });
});

describe('the sources readKnowledge reads through', () => {
  const files = { 'k/a.md': 'A', 'k/d/b.md': 'B', 'k/d/e/c.md': 'C', 'k/z.md': 'Z', 'kb/x.md': 'X' };

  it('names the files and the folders right under a folder, sorted, and nothing for an absent one', () => {
    const source = memorySource(files);
    expect(source.files('k')).toEqual(['a.md', 'z.md']);
    expect(source.dirs('k')).toEqual(['d']);
    expect(source.dirs('k/d')).toEqual(['e']);
    expect(source.files('missing')).toEqual([]);
    expect(source.dirs('missing')).toEqual([]);
  });

  it('reads a file it holds, and refuses one it does not', () => {
    const source = memorySource(files);
    expect(source.read('k/d/b.md')).toBe('B');
    expect(() => source.read('k/nope.md')).toThrow(/k\/nope\.md is not among the files read/);
    expect(() => source.read('toString')).toThrow(/not among the files read/);
  });

  it('lists the disk the same way', () => {
    const source = diskSource(tree(files));
    expect(source.files('k')).toEqual(['a.md', 'z.md']);
    expect(source.dirs('k')).toEqual(['d']);
    expect(source.read('k/d/b.md')).toBe('B');
    expect(source.files('missing')).toEqual([]);
  });
});

describe('parseEntryFile — a proposed entry (PRD #68)', () => {
  const proposedRule = (line) =>
    [
      '## BR-ADVISOR-1',
      '',
      'A quote expires 30 days after it is sent.',
      '',
      'Serves: P-ADVISOR-1',
      'Source: PRD #68',
      'Enforced by: unenforced',
      'Stated: 2026-09-25',
      line,
    ].join('\n');

  it('reads "Proposed: invade 2026-09-25" as proposed by invade on that date', () => {
    const [rule] = parseEntryFile('r.md', proposedRule('Proposed: invade 2026-09-25'), DOMAIN_RULES);
    expect(rule.proposed).toEqual({ by: 'invade', on: '2026-09-25' });
    expect(rule.problems).toEqual([]);
  });

  it('reads an entry without the line as not proposed', () => {
    const [rule] = parseEntryFile('r.md', proposedRule(''), DOMAIN_RULES);
    expect(rule.proposed).toBeNull();
    expect(rule.problems).toEqual([]);
  });

  it('refuses a malformed Proposed: line, naming the file — and still reads the entry as proposed', () => {
    for (const line of ['Proposed: invade', 'Proposed: 2026-09-25', 'Proposed: invade 25/09/2026', 'Proposed:']) {
      const [rule] = parseEntryFile('docs/knowledge/domains/advisor/rules.md', proposedRule(line), DOMAIN_RULES);
      expect(rule.proposed).toEqual({ by: null, on: null });
      expect(rule.problems).toHaveLength(1);
      expect(rule.problems[0]).toMatch(
        /^docs\/knowledge\/domains\/advisor\/rules\.md: BR-ADVISOR-1 — .*Proposed: <who> <YYYY-MM-DD>/,
      );
    }
  });
});

describe('parseEntryFile — a harvested entry carries Merged: as its own field (PRD #82)', () => {
  const LEDGER = '.omni-loop/delivery/shipped/0050-question-intros/outbox/settled.md';
  const harvestedRule = (ledger = LEDGER) =>
    [
      '## BR-PRODUCT-1',
      '',
      'An intro or a punchline is refused only past 120 characters or when it is not in plain words.',
      '',
      'Serves: P-PRODUCT-1',
      `Source: ${ledger}, entry s1-01-fun-line-sentence-count, PRD #50`,
      'Enforced by: unenforced',
      'Stated: 2026-09-26',
      'Decided: nobody — adopted when raised (medium), 2026-09-25',
      'Merged: @octocat, 2026-09-26, PR #51',
      'Proposed: harvest 2026-09-26',
    ].join('\n');
  const harvestedPrinciple = (ledger = LEDGER) =>
    [
      '## P-PRODUCT-1',
      '',
      'A question reads plainly.',
      '',
      'Why: the person answering is not an engineer.',
      `Source: ${ledger}, entry s1-01-fun-line-sentence-count, PRD #50`,
      'Merged: @octocat, 2026-09-26, PR #51',
      'Proposed: harvest 2026-09-26',
    ].join('\n');
  const PRODUCT = { scope: 'product', domain: 'product', codes: ['PRODUCT'] };

  it('reads Decided: then Merged: as two fields, merged on the parsed entry', () => {
    const [rule] = parseEntryFile('r.md', harvestedRule(), { ...PRODUCT, kind: 'rule' });
    expect(rule.decided).toBe('nobody — adopted when raised (medium), 2026-09-25');
    expect(rule.merged).toBe('@octocat, 2026-09-26, PR #51');
    expect(rule.proposed).toEqual({ by: 'harvest', on: '2026-09-26' });
  });

  it('never glues Merged: onto Source:', () => {
    const [principle] = parseEntryFile('p.md', harvestedPrinciple(), { ...PRODUCT, kind: 'principle' });
    expect(principle.source).toBe(`${LEDGER}, entry s1-01-fun-line-sentence-count, PRD #50`);
    expect(principle.merged).toBe('@octocat, 2026-09-26, PR #51');
  });

  it('reads an entry without the line as merged null', () => {
    const [rule] = parseEntryFile('r.md', '## BR-PRODUCT-1\n\nx\n\nServes: P-PRODUCT-1\n', { ...PRODUCT, kind: 'rule' });
    expect(rule.merged).toBeNull();
  });

  it('omni check knowledge stays green on a harvested rule and its proposed principle', () => {
    const root = mkdtempSync(join(tmpdir(), 'registers-merged-'));
    try {
      const ledger = 'docs/delivery/shipped/0050-question-intros/outbox/settled.md';
      const files = {
        [ledger]: '# Settled\n',
        'docs/knowledge/product/principles.md': `# Product — principles\n\n${harvestedPrinciple(ledger)}\n`,
        'docs/knowledge/product/rules.md': `# Product — rules\n\n${harvestedRule(ledger)}\n`,
        'docs/knowledge/product/invariants.md': '# Product — invariants\n\nNone yet.\n',
      };
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(root, path, '..'), { recursive: true });
        writeFileSync(join(root, path), text);
      }
      const graded = gradeKnowledge({
        ctx: flatCtx(root),
        files: Object.keys(files).filter((path) => path.startsWith('docs/knowledge/')),
        glossaryText: '',
      });
      expect(graded.violations).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
