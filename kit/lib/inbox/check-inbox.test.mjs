import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { checkSpecText, findInboxViolations } from './check-inbox.mjs';

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

// Task 12's own new cases (task-12-brief.md, Step 3), verbatim.
const spec = (fields) =>
  `---\n${Object.entries({ prd: 42, title: 'A', 'blocked-by': 'none', spec: 'file', ...fields })
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : v}`)
    .join('\n')}\n---\n\n## Problem\n\nx\n`;
const violations = (files, config = {}) =>
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
it('still refuses status, branch, value and priority by name', () => {
  for (const field of ['status', 'branch', 'value', 'priority']) {
    expect(violations({ [`${IN}/0042-a/spec.md`]: spec({ [field]: 'x' }) })).toMatch(
      new RegExp(field),
    );
  }
});
