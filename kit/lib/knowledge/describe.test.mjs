import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { flatCtx } from '../../test/flat-layout.mjs';
import { describeEntry } from './describe.mjs';
import { readKnowledge } from './registers.mjs';

const roots = [];
afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop(), { recursive: true, force: true });
});

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'knowledge-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const FIXTURE = {
  'docs/knowledge/domains/advisor/principles.md': [
    '## P-ADVISOR-1',
    '',
    'The advisor drafts; a person saves.',
    '',
    'Why: serenity.',
    'Decided: in a fixture, 2026-09-23',
    'Source: a fixture',
    '',
    '## P-ADVISOR-2',
    '',
    'Nothing serves this one yet.',
    '',
    'Why: x',
    'Decided: y',
    'Source: z',
    '',
  ].join('\n'),
  'docs/knowledge/domains/advisor/rules.md': [
    '## BR-ADVISOR-1',
    '',
    'An Intent is pushed at most once.',
    '',
    'Serves: P-ADVISOR-1',
    'Source: a fixture',
    'Enforced by: unenforced',
    'Stated: 2026-09-23',
    '',
  ].join('\n'),
  'docs/knowledge/cross-domain/advisor--credits.md': [
    '## X-ADVISOR-CREDITS-1',
    '',
    'A turn is charged before it runs.',
    '',
    'Kind: rule',
    'Serves: P-ADVISOR-1',
    'Source: a fixture',
    'Enforced by: unenforced',
    'Stated: 2026-09-23',
    '',
  ].join('\n'),
};

function knowledgeOf(files) {
  return readKnowledge({ ctx: flatCtx(tree(files)) });
}

describe('Feature: where truth lives', () => {
  it('Scenario: the rules a principle produced are derived, not written', () => {
    const text = describeEntry(knowledgeOf(FIXTURE), 'P-ADVISOR-1');
    const servedBy = text.slice(text.indexOf('Served by:'));
    expect(servedBy).toContain('BR-ADVISOR-1');
    expect(servedBy).toContain('X-ADVISOR-CREDITS-1');
    expect(text).toContain('The advisor drafts; a person saves.');
  });
});

describe('describeEntry', () => {
  it('says a principle nothing serves is a wish', () => {
    const text = describeEntry(knowledgeOf(FIXTURE), 'P-ADVISOR-2');
    expect(text).toMatch(/Served by:\n {2}nothing yet — this principle is a wish/);
  });

  it('names the principle a rule serves', () => {
    const text = describeEntry(knowledgeOf(FIXTURE), 'BR-ADVISOR-1');
    expect(text).toMatch(/It serves:\n {2}P-ADVISOR-1 \(principle/);
    expect(text).not.toContain('Served by:');
  });

  it('returns null for an id nothing claims', () => {
    expect(describeEntry(knowledgeOf(FIXTURE), 'P-ADVISOR-9')).toBeNull();
  });
});
