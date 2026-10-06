import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { parseFrontMatterLines } from '../front-matter.ts';
import { parseSpec, readInbox } from './inbox.ts';
import { assertDefined } from '../../test/assert.ts';

const IN = '.omni-loop/delivery/inbox';

function specText({ frontMatter = {} }: { frontMatter?: Record<string, unknown> } = {}) {
  const fm = {
    prd: 42,
    title: 'The inbox, and a planner that ranks it',
    'blocked-by': 'none',
    spec: 'file',
    ...frontMatter,
  };
  const fmLines = Object.entries<unknown>(fm)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : String(value)}`);
  return ['---', ...fmLines, '---', ''].join('\n');
}

describe('parseFrontMatterLines', () => {
  it('reads plain key: value lines', () => {
    const { data, errors } = parseFrontMatterLines('prd: 42\ntitle: The inbox\n');
    expect(errors).toEqual([]);
    expect(data).toEqual({ prd: '42', title: 'The inbox' });
  });

  it('strips a quoted value', () => {
    const { data } = parseFrontMatterLines('title: "The inbox, and a planner"\n');
    expect(data.title).toBe('The inbox, and a planner');
  });

  it('reports a line with no colon', () => {
    const { errors } = parseFrontMatterLines('this has no colon\n');
    expect(errors).toEqual([expect.stringContaining('this has no colon')]);
  });
});

describe('parseSpec — the happy path', () => {
  it('parses a well-formed file into a typed record', () => {
    const result = parseSpec(specText(), { file: `${IN}/0042-inbox-and-planner/spec.md` });
    expect(result.ok).toBe(true);
    expect(result.record).toEqual({
      prd: 42,
      title: 'The inbox, and a planner that ranks it',
      blockedBy: 'none',
      spec: 'file',
      file: `${IN}/0042-inbox-and-planner/spec.md`,
    });
  });

  it('coerces prd to a number', () => {
    const result = parseSpec(specText());
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(result.record.prd).toBe(42);
  });

  it('parses a bracketed blocked-by list into numbers', () => {
    const result = parseSpec(specText({ frontMatter: { 'blocked-by': '[966]' } }));
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(result.record.blockedBy).toEqual([966]);
  });

  it('parses a multi-entry blocked-by list', () => {
    const result = parseSpec(specText({ frontMatter: { 'blocked-by': '[966, 1002]' } }));
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(result.record.blockedBy).toEqual([966, 1002]);
  });

  it('accepts spec: issue for a backfilled PRD', () => {
    const result = parseSpec(specText({ frontMatter: { spec: 'issue' } }));
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(result.record.spec).toBe('issue');
  });

  it('accepts an optional areas list, naming knowledge domains', () => {
    const result = parseSpec(specText({ frontMatter: { areas: ['credits', 'quotes'] } }));
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(result.record.areas).toEqual(['credits', 'quotes']);
  });
});

describe('parseSpec — the proof field (PRD 798)', () => {
  it('accepts proof: video and carries it on the record', () => {
    const result = parseSpec(specText({ frontMatter: { proof: 'video' } }));
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(result.record.proof).toBe('video');
  });

  it('leaves proof off the record when the spec has none', () => {
    const result = parseSpec(specText());
    expect(result.ok).toBe(true);
    expect(result.record).not.toHaveProperty('proof');
  });

  it('refuses any other value, naming the field', () => {
    for (const value of ['yes', 'true', 'gif', '']) {
      const result = parseSpec(specText({ frontMatter: { proof: value } }), { file: 'x/spec.md' });
      expect(result.ok).toBe(false);
      assertDefined(result.errors, 'result.errors');
      expect(result.errors.join('\n')).toMatch(/^x\/spec\.md: proof: /m);
    }
  });
});

describe('parseSpec — the inbox spec records no status', () => {
  it('refuses a file carrying a status field, naming it', () => {
    const text = specText().replace('---\n', '---\nstatus: in-flight\n');
    const result = parseSpec(text);
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('status'))).toBe(true);
  });

  it('refuses a file carrying a branch field, naming it', () => {
    const text = specText().replace('---\n', '---\nbranch: feat/x\n');
    const result = parseSpec(text);
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('branch'))).toBe(true);
  });

  it('refuses a file carrying a value field, naming it', () => {
    const text = specText().replace('---\n', '---\nvalue: high\n');
    const result = parseSpec(text);
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('value'))).toBe(true);
  });

  it('refuses a file carrying a priority field, naming it', () => {
    const text = specText().replace('---\n', '---\npriority: 1\n');
    const result = parseSpec(text);
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('priority'))).toBe(true);
  });

  it('refuses a file carrying a plan field, naming it — the plan is the sibling plan.md', () => {
    const text = specText().replace('---\n', '---\nplan: none\n');
    const result = parseSpec(text);
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('plan'))).toBe(true);
  });

  it('names no business value anywhere in a well-formed record', () => {
    const result = parseSpec(specText());
    expect(result.ok).toBe(true);
    assertDefined(result.record, 'result.record');
    expect(Object.keys(result.record)).not.toContain('value');
    assertDefined(result.record, 'result.record');
    expect(Object.keys(result.record)).not.toContain('status');
    assertDefined(result.record, 'result.record');
    expect(Object.keys(result.record)).not.toContain('branch');
    assertDefined(result.record, 'result.record');
    expect(Object.keys(result.record)).not.toContain('priority');
    assertDefined(result.record, 'result.record');
    expect(Object.keys(result.record)).not.toContain('plan');
  });
});

describe('parseSpec — a malformed inbox spec is refused', () => {
  it('fails when there is no front-matter block at all', () => {
    const result = parseSpec('# Not an inbox spec\n');
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('front-matter block'))).toBe(true);
  });

  it('fails and names what is missing when a required field is absent', () => {
    const result = parseSpec(specText({ frontMatter: { spec: undefined } }));
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('spec'))).toBe(true);
  });

  it('fails and names the field when title is missing', () => {
    const result = parseSpec(specText({ frontMatter: { title: undefined } }));
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('title'))).toBe(true);
  });

  it('fails on a non-numeric prd', () => {
    const result = parseSpec(specText({ frontMatter: { prd: 'nope' } }));
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('prd'))).toBe(true);
  });

  it('fails on an unknown spec value', () => {
    const result = parseSpec(specText({ frontMatter: { spec: 'wiki' } }));
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('spec'))).toBe(true);
  });

  it('fails on a blocked-by that is neither "none" nor a bracketed list', () => {
    const result = parseSpec(specText({ frontMatter: { 'blocked-by': 'yes' } }));
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('blocked-by'))).toBe(true);
  });

  it('prefixes every error with the file when one is given', () => {
    const result = parseSpec(specText({ frontMatter: { spec: 'wiki' } }), {
      file: `${IN}/0042-bad/spec.md`,
    });
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.every((e) => e.startsWith(`${IN}/0042-bad/spec.md:`))).toBe(true);
  });
});

describe('parseSpec — a dependency that names no PRD is refused', () => {
  it('fails on a blocked-by that is not a positive-integer list', () => {
    const result = parseSpec(specText({ frontMatter: { 'blocked-by': '[abc]' } }));
    expect(result.ok).toBe(false);
    assertDefined(result.errors, 'result.errors');
    expect(result.errors.some((e) => e.includes('blocked-by'))).toBe(true);
  });

  // Whether a named PRD number actually exists is a cross-folder, boundary check made by
  // check-inbox.mjs over the whole inbox tree — see check-inbox.test.mjs.
});

describe('readInbox', () => {
  it('returns [] on an empty tree', () => {
    const { ctx } = makeRepo({});
    expect(readInbox({ ctx })).toEqual([]);
  });

  it('reads every well-formed record', () => {
    const { ctx } = makeRepo({
      files: { [`${IN}/0042-inbox-and-planner/spec.md`]: specText() },
    });

    const records = readInbox({ ctx });
    expect(records).toHaveLength(1);
    assertDefined(records[0], 'records[0]');
    expect(records[0].prd).toBe(42);
  });

  it('throws loudly on a malformed file rather than silently dropping it', () => {
    const { ctx } = makeRepo({
      files: { [`${IN}/0042-bad/spec.md`]: specText({ frontMatter: { spec: 'wiki' } }) },
    });

    expect(() => readInbox({ ctx })).toThrow(/spec/);
  });
});
