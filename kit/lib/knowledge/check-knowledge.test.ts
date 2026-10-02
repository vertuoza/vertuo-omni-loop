import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { flatCtx } from '../../test/flat-layout.ts';
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
      'libs/vertuo-ai-real/package.json': '{}',
      'docs/knowledge/domains/advisor/README.md':
        '# advisor\n\nGlossary term: Advisor\n\n## Owning libraries\n\n- `libs/vertuo-ai-real`\n- `libs/vertuo-ai-gone`\n',
      [ADVISOR_PRINCIPLES]: principle('P-ADVISOR-1'),
    });
    const { violations } = grade(root);
    expect(violations).toEqual([
      'docs/knowledge/domains/advisor/README.md: advisor — names owning library libs/vertuo-ai-gone, which does not exist.',
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
