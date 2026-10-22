import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { flatCtx } from '../../test/flat-layout.ts';
import { writeOwnersBlock } from '../codeowners-laws.ts';
import { gradeKnowledge } from './check-knowledge.ts';
import { readKnowledge } from './registers.ts';
import { assertDefined } from '../../test/assert.ts';

const matching = (pattern: RegExp): unknown => expect.stringMatching(pattern);

/** Each fixture domain's glossary term; the fixture glossary holds every one. */
const TERMS: Record<string, string> = {
  advisor: 'Advisor',
  credits: 'Credit Pack',
  folder: 'Folder',
  extraction: 'Extraction',
};
const GLOSSARY_TEXT = Object.values(TERMS)
  .map((term) => `**${term}**: a word.`)
  .join('\n');

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/**
 * A knowledge tree holding `files`, completed so that only what a test writes can be wrong: the
 * product folder and every domain named in a path (or in `domains`) get whichever of their four
 * files the test left out — an empty layer file, a README naming the domain's glossary term.
 */
function tree(files: Record<string, string>, { domains = [] }: { domains?: string[] } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'check-knowledge-'));
  roots.push(root);
  const named = new Set(domains);
  for (const path of Object.keys(files)) {
    const match = path.match(/^docs\/knowledge\/domains\/([^/]+)\//);
    if (match) {
      assertDefined(match[1], 'the domain folder');
      named.add(match[1]);
    }
  }
  const all: Record<string, string> = { ...files };
  for (const layer of ['principles.md', 'rules.md', 'invariants.md']) {
    all[`docs/knowledge/product/${layer}`] ??= '# Product\n';
    for (const domain of named) all[`docs/knowledge/domains/${domain}/${layer}`] ??= '# Domain\n';
  }
  for (const domain of named) {
    all[`docs/knowledge/domains/${domain}/README.md`] ??=
      `# ${domain}\n\nGlossary term: ${TERMS[domain] ?? domain}\n`;
  }
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** Grades `root`'s knowledge folder through the flat (upstream) layout: `{ violations, wishes }`, both text. */
function grade(root: string, options: { glossaryText?: string } = {}) {
  const ctx = flatCtx(root) as Parameters<typeof gradeKnowledge>[0]['ctx'];
  const knowledge = readKnowledge({ ctx });
  const entryFiles = [...new Set(knowledge.entries.map((entry) => entry.file))];
  return gradeKnowledge({ ctx, files: entryFiles, glossaryText: GLOSSARY_TEXT, ...options });
}

function principle(id: string, { extra = [] }: { extra?: string[] } = {}): string {
  return [
    `## ${id}`,
    '',
    'A product decision.',
    '',
    'Why: because a person said so.',
    'Decided: in a fixture, 2026-09-23',
    'Source: PRD #1081',
    ...extra,
    '',
  ].join('\n');
}

function rule(id: string, { serves = 'P-ADVISOR-1', extra = [] }: { serves?: string | null; extra?: string[] } = {}): string {
  return [
    `## ${id}`,
    '',
    'A provable statement.',
    '',
    ...(serves ? [`Serves: ${serves}`] : []),
    'Source: PRD #1081',
    'Enforced by: unenforced',
    'Stated: 2026-09-23',
    ...extra,
    '',
  ].join('\n');
}

function crossDomain(id: string, { serves, kind = 'rule' }: { serves?: string; kind?: string | null } = {}): string {
  return [
    `## ${id}`,
    '',
    'A statement where two domains meet.',
    '',
    ...(kind ? [`Kind: ${kind}`] : []),
    ...(serves ? [`Serves: ${serves}`] : []),
    'Source: PRD #1081',
    'Enforced by: unenforced',
    'Stated: 2026-09-23',
    '',
  ].join('\n');
}

const ADVISOR_PRINCIPLES = 'docs/knowledge/domains/advisor/principles.md';
const ADVISOR_RULES = 'docs/knowledge/domains/advisor/rules.md';

/**
 * A violation (or wish) is formatted `${file}: ${id} — ${detail}`; split it back apart on the
 * FIRST ": " and the first " — " that follows — neither a file path nor an id ever holds either.
 */
function parseLine(line: string): { file: string; id: string; detail: string } {
  const colon = line.indexOf(': ');
  const file = line.slice(0, colon);
  const rest = line.slice(colon + 2);
  const dash = rest.indexOf(' — ');
  return { file, id: rest.slice(0, dash), detail: rest.slice(dash + 3) };
}

/** The ids every violation names. */
function idsFailed(result: { violations: string[] }): string[] {
  return result.violations.map((line) => parseLine(line).id);
}

describe('Feature: where truth lives', () => {
  it('Scenario: a rule serves an existing principle', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-ADVISOR-1' }),
    });
    const result = grade(root);
    expect(result.violations).toEqual([]);
    expect(result.wishes).toEqual([]);
  });

  it('Scenario: a rule that serves no principle is refused', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1') + '\n' + rule('BR-ADVISOR-2', { serves: null }),
    });
    const { violations } = grade(root);
    expect(violations).toHaveLength(1);
    const [violation] = violations.map(parseLine);
    expect(violation).toMatchObject({ id: 'BR-ADVISOR-2', file: ADVISOR_RULES });
    assertDefined(violation, 'violation');
    expect(violation.detail).toMatch(/missing a "Serves:" line/);
  });

  it('Scenario: a principle no rule serves is a wish, not a failure', () => {
    const root = tree({ 'docs/knowledge/domains/folder/principles.md': principle('P-FOLDER-4') });
    const { violations, wishes } = grade(root);
    expect(violations).toEqual([]);
    expect(wishes.map((line) => parseLine(line).id)).toEqual(['P-FOLDER-4']);
    assertDefined(wishes[0], 'wishes[0]');
    expect(parseLine(wishes[0]).detail).toMatch(/is a wish/);
  });

  it('Scenario: a principle carries no enforcement claim', () => {
    const root = tree({
      'docs/knowledge/domains/credits/principles.md': principle('P-CREDITS-1', {
        extra: ['Enforced by: unenforced'],
      }),
    });
    const { violations } = grade(root);
    expect(idsFailed({ violations })).toEqual(['P-CREDITS-1']);
    assertDefined(violations[0], 'violations[0]');
    expect(parseLine(violations[0]).detail).toMatch(/judged, not proven/);
  });

  it("Scenario: an id's prefix names its domain", () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-CREDITS-1'),
    });
    const { violations } = grade(root);
    expect(idsFailed({ violations })).toEqual(['BR-CREDITS-1']);
    assertDefined(violations[0], 'violations[0]');
    expect(parseLine(violations[0]).detail).toMatch(/no "Kept id:" line/);
  });

  it('Scenario: a kept id may keep its old prefix', () => {
    const root = tree({
      'docs/knowledge/domains/credits/principles.md': principle('P-CREDITS-1'),
      'docs/knowledge/domains/credits/rules.md': rule('BR-TENANT-1', {
        serves: 'P-CREDITS-1',
        extra: ['Kept id: written as a Tenant rule before this folder existed.'],
      }),
    });
    expect(grade(root).violations).toEqual([]);
  });

  it('Scenario: a cross-domain pair is written in alphabetical order', () => {
    const root = tree(
      {
        'docs/knowledge/product/principles.md': principle('P-PRODUCT-1'),
        'docs/knowledge/cross-domain/credits--advisor.md': crossDomain('X-CREDITS-ADVISOR-1', {
          serves: 'P-PRODUCT-1',
        }),
      },
      { domains: ['advisor', 'credits'] },
    );
    const { violations } = grade(root);
    expect(idsFailed({ violations })).toEqual(['credits--advisor']);
    assertDefined(violations[0], 'violations[0]');
    expect(parseLine(violations[0]).detail).toMatch(/advisor--credits/);
  });

  it('Scenario: a cross-domain entry serves a principle of its own pair', () => {
    const root = tree(
      {
        'docs/knowledge/domains/folder/principles.md': principle('P-FOLDER-1'),
        'docs/knowledge/cross-domain/advisor--credits.md': crossDomain('X-ADVISOR-CREDITS-1', {
          serves: 'P-FOLDER-1',
        }),
      },
      { domains: ['advisor', 'credits'] },
    );
    const { violations } = grade(root);
    expect(idsFailed({ violations })).toEqual(['X-ADVISOR-CREDITS-1']);
    assertDefined(violations[0], 'violations[0]');
    expect(parseLine(violations[0]).detail).toMatch(/own pair/);
  });
});

describe('cross-domain — what a pair may and may not say', () => {
  const base = { domains: ['advisor', 'credits'] };

  it("accepts an entry serving a product principle, or a principle of either of its pair's domains", () => {
    const root = tree(
      {
        'docs/knowledge/product/principles.md': principle('P-PRODUCT-1'),
        'docs/knowledge/domains/credits/principles.md': principle('P-CREDITS-1'),
        'docs/knowledge/cross-domain/advisor--credits.md':
          crossDomain('X-ADVISOR-CREDITS-1', { serves: 'P-PRODUCT-1' }) +
          '\n' +
          crossDomain('X-ADVISOR-CREDITS-2', { serves: 'P-CREDITS-1', kind: 'invariant' }),
      },
      base,
    );
    expect(grade(root).violations).toEqual([]);
  });

  it('refuses an entry with no Kind:, a principle placed there, and an id naming the wrong pair', () => {
    const root = tree(
      {
        'docs/knowledge/cross-domain/advisor--credits.md':
          crossDomain('X-ADVISOR-CREDITS-1', { kind: null }) +
          '\n' +
          crossDomain('X-ADVISOR-CREDITS-2', { kind: 'principle' }) +
          '\n' +
          crossDomain('X-ADVISOR-FOLDER-1') +
          '\n' +
          principle('P-ADVISOR-9'),
      },
      base,
    );
    const failed = idsFailed(grade(root));
    expect(failed).toEqual(
      expect.arrayContaining([
        'X-ADVISOR-CREDITS-1',
        'X-ADVISOR-CREDITS-2',
        'X-ADVISOR-FOLDER-1',
        'P-ADVISOR-9',
      ]),
    );
  });

  it('refuses a pair naming a domain that has no folder', () => {
    const root = tree(
      { 'docs/knowledge/cross-domain/advisor--nowhere.md': crossDomain('X-ADVISOR-NOWHERE-1') },
      base,
    );
    expect(grade(root).violations.map((line) => parseLine(line).detail)).toEqual(
      expect.arrayContaining([expect.stringMatching(/"nowhere", which is not a domain folder/)]),
    );
  });
});

describe('the lines each kind carries', () => {
  it('refuses a rule serving a principle nobody claims, or two principles at once', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]:
        rule('BR-ADVISOR-1', { serves: 'P-ADVISOR-7' }) +
        '\n' +
        rule('BR-ADVISOR-2', { serves: 'P-ADVISOR-1, P-PRODUCT-1' }) +
        '\n' +
        rule('BR-ADVISOR-3', { extra: ['Serves: P-ADVISOR-1'] }),
    });
    const { violations } = grade(root);
    expect(violations.map((line) => [parseLine(line).id, parseLine(line).detail])).toEqual(
      expect.arrayContaining([
        ['BR-ADVISOR-1', expect.stringMatching(/no principle claims/)],
        ['BR-ADVISOR-2', expect.stringMatching(/not one principle id/)],
        ['BR-ADVISOR-3', expect.stringMatching(/more than one "Serves:"/)],
      ]),
    );
  });

  it('refuses a principle missing its Why:, Decided: or Source:', () => {
    const root = tree({ [ADVISOR_PRINCIPLES]: '## P-ADVISOR-1\n\nA product decision.\n' });
    expect(grade(root).violations.map((line) => parseLine(line).detail)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/missing a "Source:"/),
        expect.stringMatching(/missing a "Why:"/),
        expect.stringMatching(/missing a "Decided:"/),
      ]),
    );
  });

  it('refuses a rule or invariant missing its statement, Stated date or Enforced by line', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: '## BR-ADVISOR-1\n\nServes: P-ADVISOR-1\nSource: PRD #1081\n',
      'docs/knowledge/domains/advisor/invariants.md':
        '## N-ADVISOR-1\n\nHolds.\n\nSource: PRD #1081\n',
    });
    const details = grade(root).violations.map((line) => {
      const { id, detail } = parseLine(line);
      return `${id} ${detail}`;
    });
    expect(details).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^BR-ADVISOR-1 has no statement/),
        expect.stringMatching(/^BR-ADVISOR-1 is missing a "Stated:/),
        expect.stringMatching(/^BR-ADVISOR-1 is missing an "Enforced by:/),
        expect.stringMatching(/^N-ADVISOR-1 is missing a "Stated:/),
        expect.stringMatching(/^N-ADVISOR-1 is missing an "Enforced by:/),
      ]),
    );
  });

  it('refuses an id of the wrong layer, and a Core Invariant id outside product/invariants.md', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('P-ADVISOR-2'),
      'docs/knowledge/domains/advisor/invariants.md':
        '## N9\n\nHolds.\n\nSource: PRD #1081\nEnforced by: unenforced\nStated: 2026-09-23\n',
    });
    const { violations } = grade(root);
    expect(idsFailed({ violations })).toEqual(['P-ADVISOR-2', 'N9']);
  });

  it('accepts N1…N8 and N-PRODUCT-<n> in product/invariants.md', () => {
    const invariant = (id: string) =>
      `## ${id}\n\nHolds.\n\nSource: PRD #1081\nEnforced by: unenforced\nStated: 2026-09-23\n`;
    const root = tree({
      'docs/knowledge/product/invariants.md': invariant('N1') + '\n' + invariant('N-PRODUCT-1'),
    });
    expect(grade(root).violations).toEqual([]);
  });
});

describe('honesty — a claim names something real', () => {
  it('refuses an Enforced by: or Source: path that does not exist, naming the file and the id', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1', { extra: [] }).replace(
        'Source: PRD #1081',
        'Source: docs/adr/9999-nothing.md',
      ),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1').replace(
        'Enforced by: unenforced',
        'Enforced by: scripts/does-not-exist.mjs',
      ),
    });
    const { violations } = grade(root);
    expect(violations.map((line) => [parseLine(line).file, parseLine(line).id])).toEqual([
      [ADVISOR_PRINCIPLES, 'P-ADVISOR-1'],
      [ADVISOR_RULES, 'BR-ADVISOR-1'],
    ]);
    expect(violations.every((line) => /does not exist/.test(line))).toBe(true);
  });

  it('accepts every path named in a comma-separated Enforced by: line, when each exists', () => {
    const root = tree({
      'scripts/check-a.mjs': '',
      'scripts/check-b.mjs': '',
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1').replace(
        'Enforced by: unenforced',
        'Enforced by: `scripts/check-a.mjs`, scripts/check-b.mjs',
      ),
    });
    expect(grade(root).violations).toEqual([]);
  });

  it('refuses an id cited in an entry file that resolves to nothing', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { extra: ['', 'Note: see BR-ADVISOR-9.'] }),
    });
    const { violations } = grade(root);
    expect(violations).toEqual([
      `${ADVISOR_RULES}: BR-ADVISOR-9 — is cited in ${ADVISOR_RULES} but does not resolve to any entry.`,
    ]);
  });

  it('refuses a reused id, naming the second claim', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1') + '\n' + principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1'),
    });
    const { violations } = grade(root);
    expect(violations).toHaveLength(1);
    assertDefined(violations[0], 'violations[0]');
    expect(parseLine(violations[0]).detail).toMatch(/already used in/);
  });
});

describe('strictness — every line leads somewhere real', () => {
  it("refuses a domain rule serving another domain's principle — that is a cross-domain entry", () => {
    const root = tree({
      'docs/knowledge/domains/folder/principles.md': principle('P-FOLDER-1'),
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-FOLDER-1' }),
    });
    expect(idsFailed(grade(root))).toEqual(['BR-ADVISOR-1']);
    const [violation] = grade(root).violations;
    assertDefined(violation, 'the violation');
    expect(parseLine(violation).detail).toMatch(/cross-domain/);
  });

  it('accepts a domain rule serving a product principle', () => {
    const root = tree({
      'docs/knowledge/product/principles.md': principle('P-PRODUCT-1'),
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-PRODUCT-1' }),
    });
    expect(grade(root).violations).toEqual([]);
  });

  it('refuses a Source: that is only free text, and accepts one that names a PRD or issue', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]:
        principle('P-ADVISOR-1').replace('Source: PRD #1081', 'Source: somewhere in the code') +
        '\n' +
        principle('P-ADVISOR-2').replace('Source: PRD #1081', 'Source: PRD #985, lifted verbatim'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1'),
    });
    const { violations } = grade(root);
    expect(violations.map((line) => parseLine(line).id)).toEqual(['P-ADVISOR-1']);
    assertDefined(violations[0], 'violations[0]');
    expect(parseLine(violations[0]).detail).toMatch(/leads nowhere/);
  });

  it('refuses a link to a heading the file does not have, in Source: and Enforced by:', () => {
    const root = tree({
      'docs/glossary.md': '# Glossary\n\n## Identity & access\n\ntext\n',
      [ADVISOR_PRINCIPLES]:
        principle('P-ADVISOR-1').replace(
          'Source: PRD #1081',
          'Source: docs/glossary.md#identity--access',
        ) +
        '\n' +
        principle('P-ADVISOR-2').replace(
          'Source: PRD #1081',
          'Source: docs/glossary.md#identity-access',
        ),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1').replace(
        'Enforced by: unenforced',
        'Enforced by: docs/glossary.md#no-such-heading',
      ),
    });
    const { violations } = grade(root);
    expect(idsFailed({ violations })).toEqual(['P-ADVISOR-2', 'BR-ADVISOR-1']);
    expect(violations.every((line) => /no heading/.test(line))).toBe(true);
  });

  it('refuses an owning library that does not exist', () => {
    const root = tree({
      'libs/nimbus-ai-real/package.json': '{}',
      'docs/knowledge/domains/advisor/README.md':
        '# advisor\n\nGlossary term: Advisor\n\n## Owning libraries\n\n- `libs/nimbus-ai-real`\n- `libs/nimbus-ai-gone`\n',
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
    });
    const { violations } = grade(root);
    expect(violations).toEqual([
      'docs/knowledge/domains/advisor/README.md: advisor — names owning library libs/nimbus-ai-gone, which does not exist.',
    ]);
  });
});

describe('the layout', () => {
  it('refuses a domain folder missing a layer file or its README', () => {
    const root = tree({}, { domains: ['advisor'] });
    rmSync(join(root, 'docs/knowledge/domains/advisor/invariants.md'));
    rmSync(join(root, 'docs/knowledge/domains/advisor/README.md'));
    expect(grade(root).violations.map((line) => parseLine(line).file)).toEqual([
      'docs/knowledge/domains/advisor/README.md',
      'docs/knowledge/domains/advisor/invariants.md',
    ]);
  });

  it('refuses a domain whose glossary term the glossary does not hold, or that names none', () => {
    const root = tree({
      'docs/knowledge/domains/advisor/README.md': '# Advisor\n\nGlossary term: Flumph\n',
      'docs/knowledge/domains/credits/README.md': '# Credits\n',
    });
    expect(grade(root).violations.map((line) => parseLine(line).detail)).toEqual([
      expect.stringMatching(/"Flumph" is not a word/),
      expect.stringMatching(/missing a "Glossary term:"/),
    ]);
  });
});

it('grades a knowledge folder at the configured path with no glossary', () => {
  const { ctx } = makeRepo({
    git: true,
    config: { laws: { source: 'knowledge' } },
    files: {
      '.omni-loop/knowledge/product/principles.md': '# Principles\n\n## P-PRODUCT-1\n\nThe AI proposes; a person accepts.\n\nWhy: trust\nDecided: owner, 2026-09-24\nSource: PRD #3\n',
      '.omni-loop/knowledge/product/rules.md': '# Rules\n\n## BR-PRODUCT-1\n\nNothing is sent without a click.\n\nServes: P-PRODUCT-1\nSource: PRD #3\nEnforced by: unenforced\nStated: 2026-09-24\n',
      '.omni-loop/knowledge/product/invariants.md': '# Invariants\n',
    },
  });
  const { violations, wishes } = gradeKnowledge({ ctx, files: ['.omni-loop/knowledge/product/principles.md', '.omni-loop/knowledge/product/rules.md', '.omni-loop/knowledge/product/invariants.md'] });
  expect(violations).toEqual([]);
  expect(wishes).toEqual([]);
});

describe('Feature: a proposed entry (PRD #68)', () => {
  /** A principle a person has not decided yet: no `Decided:` line, a `Proposed:` one. */
  function proposedPrinciple(id: string): string {
    return [
      `## ${id}`,
      '',
      'A product decision nobody confirmed.',
      '',
      'Why: the code suggests it.',
      'Source: PRD #68',
      'Proposed: invade 2026-09-25',
      '',
    ].join('\n');
  }

  it('Scenario: a proposed principle without Decided: and a rule serving it pass, one warning per proposed entry', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: proposedPrinciple('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-ADVISOR-1', extra: ['Proposed: invade 2026-09-25'] }),
    });
    const result = grade(root);
    expect(result.violations).toEqual([]);
    expect(result.proposals.map(parseLine)).toEqual([
      { file: ADVISOR_PRINCIPLES, id: 'P-ADVISOR-1', detail: matching(/proposed by invade on 2026-09-25/) },
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: matching(/proposed by invade on 2026-09-25/) },
    ]);
  });

  it('Scenario: a confirmed rule may serve a proposed principle', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: proposedPrinciple('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-ADVISOR-1' }),
    });
    const result = grade(root);
    expect(result.violations).toEqual([]);
    expect(result.proposals.map((line) => parseLine(line).id)).toEqual(['P-ADVISOR-1']);
  });

  it('Scenario: the same principle without Proposed: fails for the missing Decided:', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: proposedPrinciple('P-ADVISOR-1').replace('Proposed: invade 2026-09-25\n', ''),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-ADVISOR-1' }),
    });
    const result = grade(root);
    expect(result.violations.map((line) => parseLine(line).detail)).toEqual([
      expect.stringMatching(/missing a "Decided:" line/),
    ]);
    expect(result.proposals).toEqual([]);
  });

  it('Scenario: a proposed entry with a dead Source: anchor fails', () => {
    const root = tree({
      'docs/business-rules.md': '# Business rules\n\n## Quote expiry\n\nA quote expires.\n',
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', {
        serves: 'P-ADVISOR-1',
        extra: ['Proposed: invade 2026-09-25'],
      }).replace('Source: PRD #1081', 'Source: docs/business-rules.md#quote-renewal'),
    });
    expect(grade(root).violations.map(parseLine)).toEqual([
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: matching(/has no heading with that anchor/) },
    ]);
  });

  it('Scenario: an index entry whose Source: anchor exists passes', () => {
    const root = tree({
      'docs/business-rules.md': '# Business rules\n\n## Quote expiry\n\nA quote expires.\n',
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', {
        serves: 'P-ADVISOR-1',
        extra: ['Proposed: invade 2026-09-25'],
      }).replace('Source: PRD #1081', 'Source: docs/business-rules.md#quote-expiry'),
    });
    expect(grade(root).violations).toEqual([]);
  });

  it('Scenario: a malformed Proposed: line is refused, naming the file', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { serves: 'P-ADVISOR-1', extra: ['Proposed: invade'] }),
    });
    expect(grade(root).violations.map(parseLine)).toEqual([
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: matching(/is not "Proposed: <who> <YYYY-MM-DD>"/) },
    ]);
  });
});

describe('laws.requireProof — a law names its proof (PRD 1342)', () => {
  function gradeWith(root: string, requireProof: boolean, extra: { copyOf?: string } = {}) {
    const ctx = { ...flatCtx(root, { laws: { source: 'knowledge', requireProof } }), ...extra } as Parameters<typeof gradeKnowledge>[0]['ctx'];
    return gradeKnowledge({ ctx, files: [], glossaryText: GLOSSARY_TEXT });
  }
  const ADVISOR_INVARIANTS = 'docs/knowledge/domains/advisor/invariants.md';
  const invariant = (id: string, enforcedBy: string) =>
    `## ${id}\n\nHolds.\n\nSource: PRD #1342\nEnforced by: ${enforcedBy}\nStated: 2026-10-09\n`;

  it('accepts "pending #<n>" either way: no path to look up', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1').replace('Enforced by: unenforced', 'Enforced by: pending #12'),
      [ADVISOR_INVARIANTS]: invariant('N-ADVISOR-1', 'pending #13'),
    });
    expect(gradeWith(root, false).violations).toEqual([]);
    expect(gradeWith(root, true).violations).toEqual([]);
  });

  it('refuses an unenforced rule, invariant and cross-domain entry when it is true, naming each', () => {
    const root = tree(
      {
        [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
        [ADVISOR_RULES]: rule('BR-ADVISOR-1'),
        [ADVISOR_INVARIANTS]: invariant('N-ADVISOR-1', 'unenforced'),
        'docs/knowledge/cross-domain/advisor--credits.md': crossDomain('X-ADVISOR-CREDITS-1', { serves: 'P-ADVISOR-1' }),
      },
      { domains: ['credits'] },
    );
    expect(gradeWith(root, true).violations.map(parseLine)).toEqual([
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: matching(/^is "Enforced by: unenforced", and laws\.requireProof is true — name the test's path, or "pending #<n>", its law issue\.$/) },
      { file: ADVISOR_INVARIANTS, id: 'N-ADVISOR-1', detail: matching(/"Enforced by: unenforced".*laws\.requireProof/) },
      { file: 'docs/knowledge/cross-domain/advisor--credits.md', id: 'X-ADVISOR-CREDITS-1', detail: matching(/"Enforced by: unenforced".*laws\.requireProof/) },
    ]);
  });

  it('accepts the same tree as today when it is false', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1'),
      [ADVISOR_INVARIANTS]: invariant('N-ADVISOR-1', 'unenforced'),
    });
    expect(gradeWith(root, false).violations).toEqual([]);
  });

  it('still refuses a missing path, and a malformed pending, naming the entry', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1').replace('Enforced by: unenforced', 'Enforced by: pending 12'),
      [ADVISOR_INVARIANTS]: invariant('N-ADVISOR-1', 'kit/lib/gone.test.ts'),
    });
    expect(gradeWith(root, true).violations.map(parseLine)).toEqual([
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: matching(/is not "Enforced by: pending #<n>"/) },
      { file: ADVISOR_INVARIANTS, id: 'N-ADVISOR-1', detail: matching(/does not exist/) },
    ]);
  });

  it('never asks a proposed entry for its proof: it is no law yet', () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1', { extra: ['Proposed: invade 2026-10-09'] }),
    });
    expect(gradeWith(root, true).violations).toEqual([]);
  });

  it("never asks it of an imported copy: the target's own config decides", () => {
    const root = tree({
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
      [ADVISOR_RULES]: rule('BR-ADVISOR-1'),
    });
    expect(gradeWith(root, true, { copyOf: 'acme/back-end' }).violations).toEqual([]);
  });
});

describe('a law is a locked entry (PRD 1726)', () => {
  const TEST = 'kit/lib/advisor.test.ts';
  const LOCK = 'Locked: @pierrederval, 2026-10-14';
  const GOVERNS = 'Governs: ^kit/lib/advisor/';
  const THESIS = 'docs/knowledge/product/thesis.md';
  const law = (id: string, ...extra: string[]) =>
    rule(id, { extra: [LOCK, GOVERNS, ...extra] }).replace('Enforced by: unenforced', `Enforced by: ${TEST}`);
  function gradeWith(root: string, laws: { max?: number; owners?: string[] } = {}, extra: { copyOf?: string } = {}) {
    const ctx = { ...flatCtx(root, { laws: { source: 'knowledge', owners: ['pierrederval'], ...laws } }), ...extra } as Parameters<typeof gradeKnowledge>[0]['ctx'];
    return gradeKnowledge({ ctx, files: [], glossaryText: GLOSSARY_TEXT });
  }
  /** The ids of the rules `text` locks, any `Locked:` line counted. */
  const lockedIn = (text: string) =>
    text.split(/^## /m).slice(1).filter((entry) => entry.includes('\nLocked:')).map((entry) => entry.split('\n')[0]?.trim() ?? '');
  /** A thesis listing `ids` as its laws (PRD 1726, s2), as `omni check knowledge` asks once a law is locked. */
  const thesisOf = (ids: readonly string[]) => `# Thesis\n\n## The laws\n\n${ids.map((id) => `- ${id} — It holds. If broken: an advisor's customer is hurt.`).join('\n')}\n`;
  /** The laws' tree, its CODEOWNERS block written by `omni kb owners`' writer (s4), so only what a test changes is wrong. */
  const lawTree = (rules: string, principles = principle('P-ADVISOR-1'), thesis: string | null = thesisOf(lockedIn(rules))) => {
    const root = tree({ [ADVISOR_PRINCIPLES]: principles, [ADVISOR_RULES]: rules, [TEST]: '// a test\n', ...(thesis === null ? {} : { [THESIS]: thesis }) });
    writeOwnersBlock(flatCtx(root, { laws: { source: 'knowledge', owners: ['pierrederval'] } }));
    return root;
  };

  it('refuses a Governs: pattern the flow areas’ matcher cannot read, a glob included', () => {
    const root = lawTree(rule('BR-ADVISOR-1', { extra: ['Governs: kit/lib/advisor/**, ^kit/lib/advisor\\.ts$'] }));
    expect(gradeWith(root).violations.map(parseLine)).toEqual([
      {
        file: ADVISOR_RULES,
        id: 'BR-ADVISOR-1',
        detail: '"Governs:" lists "kit/lib/advisor/**", which is not a regular expression over paths — write it as a flow area\'s paths are written, such as ^kit/lib/outbox/.',
      },
    ]);
  });

  it('refuses a locked law the thesis does not list, and never asks an imported copy', () => {
    const root = lawTree(law('BR-ADVISOR-1'), principle('P-ADVISOR-1'), null);
    expect(gradeWith(root).violations).toEqual([
      `${THESIS}: is missing, and BR-ADVISOR-1 is locked — write the thesis, with one line per law in its "## The laws" section.`,
    ]);
    expect(gradeWith(root, {}, { copyOf: 'acme/back-end' }).violations).toEqual([]);
    const listed = lawTree(law('BR-ADVISOR-1'), principle('P-ADVISOR-1'), thesisOf(['BR-ADVISOR-1', 'BR-ADVISOR-9']));
    expect(gradeWith(listed).violations).toEqual([
      `${THESIS}: BR-ADVISOR-9 — is listed under "The laws", but it is not a locked law — remove the line, or have a person lock the entry.`,
    ]);
  });

  it('accepts a locked rule with its test and its Governs:, and any entry carrying Governs: or Proposed law:', () => {
    const root = lawTree(
      [law('BR-ADVISOR-1'), rule('BR-ADVISOR-2', { extra: [GOVERNS, 'Proposed law: the advisor answers a stranger, and a customer sees another firm’s numbers.'] })].join('\n'),
      principle('P-ADVISOR-1', { extra: [GOVERNS] }),
    );
    expect(gradeWith(root).violations).toEqual([]);
  });

  it('refuses a lock with no test: unenforced, or pending on its law issue', () => {
    const root = lawTree(
      [
        rule('BR-ADVISOR-1', { extra: [LOCK, GOVERNS] }),
        rule('BR-ADVISOR-2', { extra: [LOCK, GOVERNS] }).replace('Enforced by: unenforced', 'Enforced by: pending #7'),
      ].join('\n'),
    );
    expect(gradeWith(root).violations.map(parseLine)).toEqual([
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: 'is locked, but "Enforced by:" names no test — a law is proven: name its test\'s path.' },
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-2', detail: 'is locked, but "Enforced by:" names no test — a law is proven: name its test\'s path.' },
    ]);
  });

  it('accepts a locked law with no Governs: (PRD 2346): it is reached through its domain or its layers, or it is global', () => {
    const root = lawTree(law('BR-ADVISOR-1').replace(`${GOVERNS}\n`, ''));
    expect(gradeWith(root).violations).toEqual([]);
  });

  it('refuses a Layers: word outside the canonical list, naming the entry and what an old word means (PRD 2346)', () => {
    const root = lawTree(
      [rule('BR-ADVISOR-1', { extra: ['Layers: db, database-ish'] }), rule('BR-ADVISOR-2', { extra: ['Layers: database'] }), rule('BR-ADVISOR-3', { extra: ['Layers: db, auth'] })].join('\n'),
    );
    expect(gradeWith(root).violations.map(parseLine)).toEqual([
      {
        file: ADVISOR_RULES,
        id: 'BR-ADVISOR-1',
        detail: '"Layers:" lists "database-ish", which is not a layer — the layers are ui, api, schema, db, auth, event, cli, job, infra, ci.',
      },
      {
        file: ADVISOR_RULES,
        id: 'BR-ADVISOR-2',
        detail: '"Layers:" lists "database", which is not a layer ("database" is an old word for "db") — the layers are ui, api, schema, db, auth, event, cli, job, infra, ci.',
      },
    ]);
  });

  it('refuses an ADR tagged with a non-canonical layer or a domain with no folder, and accepts a good tag (PRD 2346)', () => {
    const adr = (n: string, tags: string) => [`docs/adr/${n}-x.md`, `# ADR-${n} — X\n\n**Status:** accepted · **Date:** 2026-10-21 · ${tags}\n\n## Context\n\nx\n`] as const;
    const root = lawTree(
      rule('BR-ADVISOR-1'),
      principle('P-ADVISOR-1'),
    );
    for (const [path, text] of [adr('0001', '**Layers:** db · **Domain:** advisor'), adr('0002', '**Layers:** database-ish'), adr('0003', '**Domain:** ask')]) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    expect(gradeWith(root).violations).toEqual([
      'docs/adr/0002-x.md: ADR-0002 — "**Layers:**" lists "database-ish", which is not a layer — the layers are ui, api, schema, db, auth, event, cli, job, infra, ci.',
      'docs/adr/0003-x.md: ADR-0003 — "**Domain:**" names "ask", which is no domain folder — the folders are product, advisor.',
    ]);
  });

  it('refuses a locked principle', () => {
    const root = lawTree(rule('BR-ADVISOR-1'), principle('P-ADVISOR-1', { extra: [LOCK, GOVERNS] }));
    expect(gradeWith(root).violations.map(parseLine)).toEqual([
      { file: ADVISOR_PRINCIPLES, id: 'P-ADVISOR-1', detail: 'is locked, but a principle is never a law — lock a rule or an invariant that serves it.' },
    ]);
  });

  it('refuses a lock beside a Proposed: line', () => {
    const root = lawTree(law('BR-ADVISOR-1', 'Proposed: invade 2026-10-12'));
    expect(gradeWith(root).violations.map(parseLine)).toEqual([
      { file: ADVISOR_RULES, id: 'BR-ADVISOR-1', detail: 'is locked and proposed at once — a person locked it: remove its "Proposed:" line.' },
    ]);
  });

  it('refuses more locks than laws.max, and accepts exactly laws.max', () => {
    const root = lawTree([law('BR-ADVISOR-1'), law('BR-ADVISOR-2'), law('BR-ADVISOR-3')].join('\n'));
    expect(gradeWith(root, { max: 3 }).violations).toEqual([]);
    expect(gradeWith(root, { max: 2 }).violations).toEqual([
      'docs/knowledge: 3 locked entries, more than laws.max (2) — a law is one of the few truths that cost the most when broken: strike one, or raise laws.max.',
    ]);
  });

  it('counts a malformed lock and a locked principle against laws.max', () => {
    const root = lawTree(law('BR-ADVISOR-1').replace(LOCK, 'Locked: someone'), principle('P-ADVISOR-1', { extra: [LOCK, GOVERNS] }));
    expect(gradeWith(root, { max: 1 }).violations).toContain(
      'docs/knowledge: 2 locked entries, more than laws.max (1) — a law is one of the few truths that cost the most when broken: strike one, or raise laws.max.',
    );
  });

  it('refuses any lock while laws.owners is empty, and nothing when nothing is locked', () => {
    const locked = lawTree(law('BR-ADVISOR-1'));
    expect(gradeWith(locked, { owners: [] }).violations).toEqual([
      'docs/knowledge: 1 locked entry, and laws.owners is empty — name who may lock a law and approve a change to one in laws.owners before locking.',
    ]);
    const unlocked = lawTree(rule('BR-ADVISOR-1'));
    expect(gradeWith(unlocked, { owners: [] }).violations).toEqual([]);
  });

  it('refuses a missing or stale CODEOWNERS block once a law is locked, and asks nothing while nothing is locked and no block is written', () => {
    const root = lawTree(law('BR-ADVISOR-1'));
    expect(gradeWith(root).violations).toEqual([]);
    rmSync(join(root, '.github/CODEOWNERS'));
    expect(gradeWith(root).violations).toEqual([
      '.github/CODEOWNERS: has no "# BEGIN omni kb owners" block, and 1 law(s) are locked — run omni kb owners, so a change to a law needs its owner\'s approval.',
    ]);
    expect(gradeWith(root, {}, { copyOf: 'acme/back-end' }).violations).toEqual([]);
    const stale = lawTree(law('BR-ADVISOR-1'));
    expect(gradeWith(stale, { owners: ['someone-else'] }).violations).toEqual([
      '.github/CODEOWNERS: its "# BEGIN omni kb owners" block is out of date with the locked laws and laws.owners — run omni kb owners.',
    ]);
    const unlocked = tree({ [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'), [ADVISOR_RULES]: rule('BR-ADVISOR-1') });
    expect(gradeWith(unlocked).violations).toEqual([]);
  });

  it("refuses a block without the briefing's lines (PRD 1793, s2), and still asks nothing of a repository with no lock and no block, or no owner", () => {
    const BRIEFING_LINES = ['# The briefing: the rules every agent follows.', '/.omni-loop/knowledge/playbook/briefing.md @pierrederval'];
    const root = lawTree(law('BR-ADVISOR-1'));
    const written = readFileSync(join(root, '.github/CODEOWNERS'), 'utf8');
    expect(written.split('\n')).toEqual(expect.arrayContaining(BRIEFING_LINES));
    writeFileSync(join(root, '.github/CODEOWNERS'), written.split('\n').filter((line) => !BRIEFING_LINES.includes(line)).join('\n'));
    expect(gradeWith(root).violations).toEqual([
      '.github/CODEOWNERS: its "# BEGIN omni kb owners" block is out of date with the locked laws and laws.owners — run omni kb owners.',
    ]);
    expect(gradeWith(root, { owners: [] }).violations).not.toContainEqual(expect.stringContaining('.github/CODEOWNERS'));
    const unlocked = tree({ [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'), [ADVISOR_RULES]: rule('BR-ADVISOR-1') });
    expect(gradeWith(unlocked).violations).toEqual([]);
  });

  it('goes red when a law is locked after the block was written, and when the markers do not pair up', () => {
    const root = lawTree([law('BR-ADVISOR-1'), rule('BR-ADVISOR-2')].join('\n'));
    writeFileSync(join(root, ADVISOR_RULES), [law('BR-ADVISOR-1'), law('BR-ADVISOR-2').replace(TEST, 'kit/lib/advisor-two.test.ts')].join('\n'));
    writeFileSync(join(root, 'kit/lib/advisor-two.test.ts'), '// a test\n');
    writeFileSync(join(root, THESIS), thesisOf(['BR-ADVISOR-1', 'BR-ADVISOR-2']));
    expect(gradeWith(root).violations).toEqual([
      '.github/CODEOWNERS: its "# BEGIN omni kb owners" block is out of date with the locked laws and laws.owners — run omni kb owners.',
    ]);
    const broken = lawTree(law('BR-ADVISOR-1'));
    writeFileSync(join(broken, '.github/CODEOWNERS'), '# BEGIN omni kb owners\n/a @x\n');
    expect(gradeWith(broken).violations).toEqual([
      '.github/CODEOWNERS: its "# BEGIN omni kb owners" and "# END omni kb owners" lines do not pair up — keep exactly one of each, in that order, or remove both.',
    ]);
  });

  it("never asks an imported copy for laws.max or laws.owners: the target's own config decides", () => {
    const root = lawTree([law('BR-ADVISOR-1'), law('BR-ADVISOR-2')].join('\n'));
    expect(gradeWith(root, { max: 1, owners: [] }, { copyOf: 'acme/back-end' }).violations).toEqual([]);
  });
});

describe('a domain contract (PRD 1796)', () => {
  const ADVISOR_CONTRACTS = 'docs/knowledge/domains/advisor/contracts.md';
  const SCHEMA = 'src/advisor/advice.schema.ts';
  const STATUS = 'src/advisor/advice-status.ts';
  function gradeWith(root: string, extra: { copyOf?: string } = {}) {
    const ctx = { ...flatCtx(root, { laws: { source: 'knowledge', owners: ['pierrederval'] } }), ...extra } as Parameters<typeof gradeKnowledge>[0]['ctx'];
    return gradeKnowledge({ ctx, files: [], glossaryText: GLOSSARY_TEXT });
  }
  function contract(id: string, { pointsTo = `${SCHEMA}, ${STATUS}`, drop = [], extra = [] }: { pointsTo?: string | null; drop?: string[]; extra?: string[] } = {}): string {
    const lines = [
      ...(pointsTo === null ? [] : [`Points to: ${pointsTo}`]),
      'Source: PRD #1796',
      'Stated: 2026-10-15',
      ...extra,
    ].filter((line) => !drop.some((field) => line.startsWith(`${field}:`)));
    return [`## ${id}`, '', 'An advice moves Draft → Sent → Read.', '', ...lines, ''].join('\n');
  }
  const contractTree = (contracts: string, files: Record<string, string> = {}) =>
    tree({ [ADVISOR_CONTRACTS]: contracts, [SCHEMA]: '// a schema\n', [STATUS]: '// a type\n', ...files });
  const detailsOf = (root: string, extra: { copyOf?: string } = {}) => gradeWith(root, extra).violations.map(parseLine);

  it('accepts a contract whose Points to: names files that exist, and one serving a principle', () => {
    expect(gradeWith(contractTree(contract('DC-ADVISOR-1'))).violations).toEqual([]);
    const serving = contractTree(contract('DC-ADVISOR-1', { extra: ['Serves: P-ADVISOR-1'] }), { [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1') });
    expect(gradeWith(serving)).toMatchObject({ violations: [], wishes: [] });
  });

  it('a folder without contracts.md raises no violation', () => {
    expect(gradeWith(tree({ [ADVISOR_RULES]: '# Rules\n' })).violations).toEqual([]);
  });

  it('refuses a missing or empty Points to:, once, naming the contract', () => {
    for (const pointsTo of [null, '']) {
      expect(detailsOf(contractTree(contract('DC-ADVISOR-1', { pointsTo })))).toEqual([
        { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail: 'is missing a "Points to:" line — a contract names the schema or type file(s) that enforce it.' },
      ]);
    }
  });

  it('refuses a path that does not exist, a directory and a glob, once each, naming the contract and the path', () => {
    const root = contractTree(contract('DC-ADVISOR-1', { pointsTo: `${SCHEMA}, src/advisor/gone.ts, src/advisor, src/advisor/*.ts` }));
    expect(detailsOf(root)).toEqual([
      { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail: 'points to "src/advisor/gone.ts", which does not exist — fix its "Points to:" line.' },
      { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail: 'points to "src/advisor", which is a directory — name the file(s) that enforce it.' },
      { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail: 'points to "src/advisor/*.ts", which is a glob — name each file that enforces it.' },
    ]);
  });

  it("never looks an imported copy's paths up: they name its target's files", () => {
    const root = contractTree(contract('DC-ADVISOR-1', { pointsTo: 'src/elsewhere/gone.ts, src/advisor' }));
    expect(gradeWith(root, { copyOf: 'acme/back-end' }).violations).toEqual([]);
  });

  it('refuses a missing Source: or Stated:, once each', () => {
    expect(detailsOf(contractTree(contract('DC-ADVISOR-1', { drop: ['Source'] })))).toEqual([
      { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail: 'is missing a "Source:" line.' },
    ]);
    expect(detailsOf(contractTree(contract('DC-ADVISOR-1', { drop: ['Stated'] })))).toEqual([
      { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail: 'is missing a "Stated: YYYY-MM-DD" line.' },
    ]);
  });

  it('refuses an Enforced by:, a Locked:, a Proposed law: and a Governs:, once each, with the reason', () => {
    const cases: [string, string][] = [
      ['Enforced by: kit/lib/advisor.test.ts', 'carries an "Enforced by:" line — a contract is never a law: the file its "Points to:" names enforces it.'],
      ['Locked: @pierrederval, 2026-10-15', 'is locked, but a contract is never a law — lock a rule or an invariant instead.'],
      ['Proposed law: an advice is lost, and its reader never knows.', 'carries a "Proposed law:" line — a contract is never a law.'],
      ['Governs: ^src/advisor/', 'carries a "Governs:" line — its "Points to:" already names the files it is about, and omni kb laws lists rules and laws only.'],
    ];
    for (const [line, detail] of cases) {
      expect(detailsOf(contractTree(contract('DC-ADVISOR-1', { extra: [line] }), { 'kit/lib/advisor.test.ts': '// a test\n' }))).toEqual([
        { file: ADVISOR_CONTRACTS, id: 'DC-ADVISOR-1', detail },
      ]);
    }
  });

  it("refuses a BR- id in contracts.md, a DC- id with another folder's code, and a DC- id in a cross-domain file", () => {
    expect(detailsOf(contractTree(contract('BR-ADVISOR-1')))).toEqual([
      { file: ADVISOR_CONTRACTS, id: 'BR-ADVISOR-1', detail: 'is a BR- id in a file of contracts, which carry DC- ids.' },
    ]);
    expect(detailsOf(contractTree(contract('DC-CREDITS-1')))).toEqual([
      { file: ADVISOR_CONTRACTS, id: 'DC-CREDITS-1', detail: 'names CREDITS, but it sits in the advisor folder (code ADVISOR) and carries no "Kept id:" line.' },
    ]);
    const cross = tree(
      { 'docs/knowledge/cross-domain/advisor--credits.md': crossDomain('DC-ADVISOR-1', { kind: 'invariant' }) },
      { domains: ['advisor', 'credits'] },
    );
    expect(detailsOf(cross)).toEqual([
      { file: 'docs/knowledge/cross-domain/advisor--credits.md', id: 'DC-ADVISOR-1', detail: 'is not an X- id — a cross-domain entry is X-<A>-<B>-<n>.' },
    ]);
  });

  it('refuses a DC- id in a file of rules, and resolves a contract cited in another entry file', () => {
    const root = contractTree(contract('DC-ADVISOR-1'), { [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'), [ADVISOR_RULES]: rule('DC-ADVISOR-2') });
    expect(detailsOf(root)).toEqual([
      { file: ADVISOR_RULES, id: 'DC-ADVISOR-2', detail: 'is a DC- id in a file of rules, which carry BR- ids.' },
    ]);
    const citing = contractTree(contract('DC-ADVISOR-1'), { [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1', { extra: ['See DC-ADVISOR-1.'] }) });
    expect(grade(citing).violations).toEqual([]);
  });
});
