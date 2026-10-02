import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { checkSpecText, findInboxViolations, inboxViolationsFor } from './check-inbox.ts';
import { assertDefined } from '../../test/assert.ts';

const IN = '.omni-loop/delivery/inbox';
const SHIPPED = '.omni-loop/delivery/shipped';

function specText({ frontMatter = {} } = {}) {
  const fm = {
    prd: 42,
    title: 'The inbox, and a planner that ranks it',
    'blocked-by': 'none',
    spec: 'file',
    ...frontMatter,
  };
  const fmLines = Object.entries(fm)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`);
  return ['---', ...fmLines, '---', ''].join('\n');
}

describe('checkSpecText', () => {
  it('finds nothing wrong with a well-formed spec', () => {
    const { ctx } = makeRepo({});
    expect(checkSpecText(`${IN}/0042-a/spec.md`, specText(), { ctx })).toEqual([]);
  });

  it('refuses a malformed spec, naming the file and the reason', () => {
    const { ctx } = makeRepo({});
    const text = specText({ frontMatter: { spec: 'wiki' } });
    const violations = checkSpecText(`${IN}/0042-a/spec.md`, text, { ctx });
    expect(violations.length).toBeGreaterThan(0);
    assertDefined(violations[0], 'violations[0]');
    expect(violations[0].startsWith(`${IN}/0042-a/spec.md:`)).toBe(true);
    expect(violations[0]).toMatch(/spec/);
  });

  it('refuses a spec carrying a status field, naming it', () => {
    const { ctx } = makeRepo({});
    const text = specText().replace('---\n', '---\nstatus: in-flight\n');
    const violations = checkSpecText(`${IN}/0042-a/spec.md`, text, { ctx });
    expect(violations.some((v) => v.includes('status'))).toBe(true);
  });

  it("refuses a prd that disagrees with its own folder's number", () => {
    const { ctx } = makeRepo({});
    const text = specText({ frontMatter: { prd: 43 } });
    const violations = checkSpecText(`${IN}/0042-a/spec.md`, text, { ctx });
    expect(violations.some((v) => v.includes('0042-a') && /43/.test(v))).toBe(true);
  });
});

describe('findInboxViolations', () => {
  it('passes on an empty tree', () => {
    const { ctx } = makeRepo({});
    expect(findInboxViolations({ ctx })).toEqual([]);
  });

  it('passes on a tree of well-formed fixture folders', () => {
    const { ctx } = makeRepo({
      files: {
        [`${IN}/0042-inbox-and-planner/spec.md`]: specText(),
        [`${IN}/0966-agent-outbox/spec.md`]: specText({
          frontMatter: { prd: 966, title: 'Agent outbox' },
        }),
      },
    });

    expect(findInboxViolations({ ctx })).toEqual([]);
  });

  it('stays green with a concept under the inbox: a concept folder holds no spec and is no PRD (PRD 686)', () => {
    const { ctx } = makeRepo({
      files: {
        [`${IN}/0042-inbox-and-planner/spec.md`]: specText(),
        [`${IN}/concepts/0712-x/concept.md`]: '---\nconcept: 712\ntitle: X\nkind: product\nscale: vast\n---\n',
        [`${IN}/concepts/0712-x/vision.html`]: `<!doctype html>${'x'.repeat(64)}\n`,
      },
      config: { limits: { beforeAfterMaxBytes: 32 } },
    });

    expect(findInboxViolations({ ctx })).toEqual([]);
    expect(inboxViolationsFor({ ctx, prd: 712 })).toEqual(['PRD 712 has no inbox folder.']);
  });

  it('collects violations across several folders, each naming its own file', () => {
    const { ctx } = makeRepo({
      files: {
        [`${IN}/0042-good/spec.md`]: specText(),
        [`${IN}/0043-bad/spec.md`]: specText({ frontMatter: { prd: 43, spec: 'wiki' } }),
      },
    });

    const violations = findInboxViolations({ ctx });
    expect(violations.some((v) => v.startsWith(`${IN}/0043-bad/spec.md:`))).toBe(true);
    expect(violations.some((v) => v.startsWith(`${IN}/0042-good/spec.md:`))).toBe(false);
  });

  describe('a dependency that names no PRD is refused', () => {
    it('refuses a blocked-by naming a PRD no inbox or shipped folder carries', () => {
      const { ctx } = makeRepo({
        files: {
          [`${IN}/0042-inbox-and-planner/spec.md`]: specText({
            frontMatter: { 'blocked-by': '[9999]' },
          }),
        },
      });

      const violations = findInboxViolations({ ctx });
      expect(
        violations.some((v) =>
          /blocked-by names PRD #9999, which no inbox or shipped folder carries/.test(v),
        ),
      ).toBe(true);
    });

    it('accepts a blocked-by naming a PRD an inbox folder does carry', () => {
      const { ctx } = makeRepo({
        files: {
          [`${IN}/0042-inbox-and-planner/spec.md`]: specText({
            frontMatter: { 'blocked-by': '[966]' },
          }),
          [`${IN}/0966-agent-outbox/spec.md`]: specText({
            frontMatter: { prd: 966, title: 'Agent outbox' },
          }),
        },
      });

      expect(findInboxViolations({ ctx })).toEqual([]);
    });

    // Task 12's own new behavior: blocked-by also resolves against a PRD that has already
    // shipped, not only one still sitting in the inbox (ctx.layout.whereIs covers both).
    it('accepts a blocked-by naming a PRD that has already shipped', () => {
      const { ctx } = makeRepo({
        files: {
          [`${IN}/0042-inbox-and-planner/spec.md`]: specText({
            frontMatter: { 'blocked-by': '[7]' },
          }),
          [`${SHIPPED}/0007-done/spec.md`]: 'a shipped PRD is not itself graded as an inbox spec',
        },
      });

      expect(findInboxViolations({ ctx })).toEqual([]);
    });
  });

  describe('an oversized page is refused', () => {
    it('refuses a before/after page over the size cap, naming its size', () => {
      const oversized = 'x'.repeat(512_001);
      const { ctx } = makeRepo({
        files: {
          [`${IN}/0042-inbox-and-planner/spec.md`]: specText(),
          [`${IN}/0042-inbox-and-planner/before-after.html`]: oversized,
        },
      });

      const violations = findInboxViolations({ ctx });
      expect(
        violations.some(
          (v) =>
            v.startsWith(`${IN}/0042-inbox-and-planner/before-after.html:`) &&
            /is 512001 bytes, over the 512000-byte cap/.test(v),
        ),
      ).toBe(true);
    });

    it('accepts a before/after page at or under the cap', () => {
      const { ctx } = makeRepo({
        files: {
          [`${IN}/0042-inbox-and-planner/spec.md`]: specText(),
          [`${IN}/0042-inbox-and-planner/before-after.html`]: 'x'.repeat(512_000),
        },
      });

      expect(findInboxViolations({ ctx })).toEqual([]);
    });

    it('does not look at another file in the folder, only before-after.html', () => {
      const { ctx } = makeRepo({
        files: {
          [`${IN}/0042-inbox-and-planner/spec.md`]: specText(),
          [`${IN}/0042-inbox-and-planner/notes.txt`]: 'x'.repeat(600_000),
        },
      });

      expect(findInboxViolations({ ctx })).toEqual([]);
    });

    it('passes when a folder has no before-after.html at all', () => {
      const { ctx } = makeRepo({
        files: { [`${IN}/0042-inbox-and-planner/spec.md`]: specText() },
      });

      expect(findInboxViolations({ ctx })).toEqual([]);
    });
  });
});

describe('inboxViolationsFor (PRD 675)', () => {
  const broken = {
    [`${IN}/0042-good/spec.md`]: specText({ frontMatter: { 'blocked-by': '[43]' } }),
    [`${IN}/0043-bad/spec.md`]: specText({ frontMatter: { prd: 44, 'blocked-by': '[9999]' } }),
    [`${IN}/0043-bad/before-after.html`]: 'x'.repeat(512_001),
    [`${IN}/0045-missing/plan.md`]: 'a folder with no spec',
  };

  it("reports exactly the violations findInboxViolations reports for that folder", () => {
    const { ctx } = makeRepo({ files: broken });
    const all = findInboxViolations({ ctx });
    for (const [prd, folder] of [[42, '0042-good'], [43, '0043-bad'], [45, '0045-missing']] as const) {
      const own = all.filter((v) => v.startsWith(`${IN}/${folder}/`));
      expect(inboxViolationsFor({ ctx, prd })).toEqual(own);
    }
  });

  it("reports nothing for another folder's faults", () => {
    const { ctx } = makeRepo({ files: broken });
    expect(inboxViolationsFor({ ctx, prd: 42 })).toEqual([]);
    expect(inboxViolationsFor({ ctx, prd: 43 }).length).toBe(3);
  });

  it('refuses a PRD with no inbox folder, even one already shipped', () => {
    const { ctx } = makeRepo({ files: { [`${SHIPPED}/0007-done/spec.md`]: specText({ frontMatter: { prd: 7 } }) } });
    expect(inboxViolationsFor({ ctx, prd: 7 })).toEqual(['PRD 7 has no inbox folder.']);
    expect(inboxViolationsFor({ ctx, prd: 8 })).toEqual(['PRD 8 has no inbox folder.']);
  });
});

// Task 12's own new cases (task-12-brief.md, Step 3), verbatim.
const spec = (fields: Record<string, unknown>) =>
  `---\n${Object.entries({ prd: 42, title: 'A', 'blocked-by': 'none', spec: 'file', ...fields })
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
    .join('\n')}\n---\n\n## Problem\n\nx\n`;
const violations = (files: Record<string, string>, config: Record<string, unknown> = {}) =>
  findInboxViolations({ ctx: makeRepo({ files, config }).ctx }).join('\n');

it('accepts a well-formed spec', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({}) })).toBe('');
});
it('refuses a plan: field — the plan is the sibling plan.md', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ plan: 'x.md' }) })).toMatch(/plan/);
});
it('refuses a prd: that disagrees with the folder number', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ prd: 43 }) })).toMatch(
    /0042-a.*43|43.*0042-a/s,
  );
});
it('refuses a missing spec.md in an inbox folder', () => {
  expect(violations({ [`${IN}/0042-a/plan.md`]: 'x' })).toMatch(/0042-a\/spec\.md/);
});
it('accepts areas: naming knowledge domains, refuses an unknown one', () => {
  const found = violations(
    {
      [`${IN}/0042-a/spec.md`]: spec({ areas: ['credits', 'nope'] }),
      '.omni-loop/knowledge/domains/credits/README.md': '# Credits\n',
    },
    { laws: { source: 'knowledge' } },
  );
  expect(found).toMatch(/nope/);
  expect(found).not.toMatch(/credits/);
});
it('grades areas: whenever the knowledge folder exists, whatever laws.source says', () => {
  const found = violations({
    [`${IN}/0042-a/spec.md`]: spec({ areas: ['credits', 'nope'] }),
    '.omni-loop/knowledge/domains/credits/README.md': '# Credits\n',
  });
  expect(found).toMatch(/nope/);
  expect(found).not.toMatch(/credits/);
});
it('leaves areas: ungraded when there is no knowledge folder', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ areas: ['nope'] }) })).not.toMatch(/nope/);
});
it('refuses a before-after page over the configured cap', () => {
  expect(
    violations(
      {
        [`${IN}/0042-a/spec.md`]: spec({}),
        [`${IN}/0042-a/before-after.html`]: '12345678901',
      },
      { limits: { beforeAfterMaxBytes: 10 } },
    ),
  ).toMatch(/before-after\.html/);
});
it('accepts proof: video and refuses proof: yes, naming the field (PRD 798)', () => {
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ proof: 'video' }) })).toBe('');
  expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ proof: 'yes' }) })).toMatch(/0042-a\/spec\.md: proof: /);
});
it('still refuses status, branch, value and priority by name', () => {
  for (const field of ['status', 'branch', 'value', 'priority']) {
    expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ [field]: 'x' }) })).toMatch(
      new RegExp(field),
    );
  }
});

describe('voice.json (PRD 822)', () => {
  const VOICE = JSON.parse(readFileSync(new URL('../voice/example.json', import.meta.url), 'utf8'));
  const folder = `${IN}/0042-inbox-and-planner`;

  it('passes a valid voice.json beside the spec', () => {
    const { ctx } = makeRepo({
      files: { [`${folder}/spec.md`]: specText(), [`${folder}/voice.json`]: JSON.stringify(VOICE) },
    });
    expect(findInboxViolations({ ctx })).toEqual([]);
    expect(inboxViolationsFor({ ctx, prd: 42 })).toEqual([]);
  });

  it('refuses an invalid voice.json, naming the file, the round and the field', () => {
    const bad = JSON.parse(JSON.stringify(VOICE));
    bad.rounds[1].personas[0].score = 9;
    const { ctx } = makeRepo({
      files: { [`${folder}/spec.md`]: specText(), [`${folder}/voice.json`]: JSON.stringify(bad) },
    });
    const expected = [`${folder}/voice.json: round spec: personas[0].score must be a whole number from 1 to 5.`];
    expect(findInboxViolations({ ctx })).toEqual(expected);
    expect(inboxViolationsFor({ ctx, prd: 42 })).toEqual(expected);
  });

  it('refuses a voice.json that is not JSON', () => {
    const { ctx } = makeRepo({ files: { [`${folder}/spec.md`]: specText(), [`${folder}/voice.json`]: '{' } });
    expect(findInboxViolations({ ctx })).toEqual([`${folder}/voice.json: not valid JSON.`]);
  });
});
