import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { AccountFrontMatterSchema, excusePathProblem, OutboxItemFrontMatterSchema, SpecFrontMatterSchema } from './front-matter.ts';
import { KIT_MESSAGES } from './messages.ts';
import type { OutboxItemId, PrdNumber, ProductPrdId, WorkSliceId } from '../ids.ts';

const firstIssue = (schema: z.ZodType, value: unknown) => schema.safeParse(value, { error: KIT_MESSAGES }).error?.issues[0];

describe('SpecFrontMatterSchema', () => {
  it('reads an inbox spec, its numbers and lists out of plain strings', () => {
    expect(SpecFrontMatterSchema.parse({ prd: '7', title: ' Typed ', 'blocked-by': '[3, 5]', spec: 'file', areas: '[credits, outbox]' })).toEqual({
      prd: 7,
      title: 'Typed',
      'blocked-by': [3, 5],
      spec: 'file',
      areas: ['credits', 'outbox'],
    });
    expect(SpecFrontMatterSchema.parse({ prd: '7', title: 'Typed', 'blocked-by': 'none', spec: 'issue', proof: 'video' })['blocked-by']).toBe('none');
  });

  it('refuses a missing title, naming it', () => {
    const issue = firstIssue(SpecFrontMatterSchema, { prd: '7', 'blocked-by': 'none', spec: 'file' });
    expect(issue?.path).toEqual(['title']);
    expect(issue?.message).toBe('Required');
  });

  it('refuses a malformed blocked-by and an unknown spec, naming each', () => {
    expect(firstIssue(SpecFrontMatterSchema, { prd: '7', title: 'T', 'blocked-by': '966', spec: 'file' })?.path).toEqual(['blocked-by']);
    const issue = firstIssue(SpecFrontMatterSchema, { prd: '7', title: 'T', 'blocked-by': 'none', spec: 'wiki' });
    expect(issue?.path).toEqual(['spec']);
    expect(issue?.message).toBe('spec must be one of: file, issue');
  });

  it('refuses a status, by its name', () => {
    const issue = firstIssue(SpecFrontMatterSchema, { prd: '7', title: 'T', 'blocked-by': 'none', spec: 'file', status: 'done' });
    expect(issue?.code).toBe('unrecognized_keys');
    expect(issue?.code === 'unrecognized_keys' && issue.keys).toEqual(['status']);
  });
});

describe('OutboxItemFrontMatterSchema', () => {
  const item = { id: 's3-01-zod', prd: '725', slice: 's3', rank: 'medium', 'bears-on': 'none', raised: '2026-10-01', wave: '3' };

  it('reads an outbox item', () => {
    expect(OutboxItemFrontMatterSchema.parse(item)).toEqual({ ...item, prd: 725, wave: 3 });
  });

  it('reads a product PRD\'s item by its id, and refuses a PRD that is neither, naming it (PRD 1548)', () => {
    expect(OutboxItemFrontMatterSchema.parse({ ...item, prd: 'mobile-12' }).prd).toBe('mobile-12');
    for (const prd of ['mobile', '0', 'Mobile-12', '12-mobile']) {
      const issue = firstIssue(OutboxItemFrontMatterSchema, { ...item, prd });
      expect(issue?.path).toEqual(['prd']);
      expect(issue?.message).toBe('prd must be a number, or a product PRD like mobile-12');
    }
  });

  it('refuses an unknown rank and a bad date, naming each', () => {
    const rank = firstIssue(OutboxItemFrontMatterSchema, { ...item, rank: 'low' });
    expect(rank?.path).toEqual(['rank']);
    expect(rank?.message).toBe('rank must be one of: human-action, high, medium');
    const raised = firstIssue(OutboxItemFrontMatterSchema, { ...item, raised: 'yesterday' });
    expect(raised?.path).toEqual(['raised']);
    expect(raised?.message).toBe('raised must be a YYYY-MM-DD date');
  });

  it('reads its id, its PRD and its slice into their brands, a rework\'s included (PRD 1049)', () => {
    const read = OutboxItemFrontMatterSchema.parse(item);
    expectTypeOf(read.id).toEqualTypeOf<OutboxItemId>();
    expectTypeOf(read.prd).toEqualTypeOf<PrdNumber | ProductPrdId>();
    expectTypeOf(read.slice).toEqualTypeOf<WorkSliceId>();
    const rework = { ...item, id: 'fix-s3-01-zod-01-crew', slice: 'fix-s3-01-zod' };
    expect(OutboxItemFrontMatterSchema.parse(rework)).toMatchObject({ id: 'fix-s3-01-zod-01-crew', slice: 'fix-s3-01-zod' });
  });

  it('refuses an id with no slug and a slice that is no slice, naming each', () => {
    expect(firstIssue(OutboxItemFrontMatterSchema, { ...item, id: 's3-01' })?.path).toEqual(['id']);
    expect(firstIssue(OutboxItemFrontMatterSchema, { ...item, slice: 'S3' })?.path).toEqual(['slice']);
  });

  it('reads the exact paths an item excuses, and an item without the field as before (PRD 2898)', () => {
    expect(OutboxItemFrontMatterSchema.parse({ ...item, excuses: '[kit/lib/init/labels.ts, a/b.test.ts]' }).excuses).toEqual(['kit/lib/init/labels.ts', 'a/b.test.ts']);
    expect(Object.hasOwn(OutboxItemFrontMatterSchema.parse(item), 'excuses')).toBe(false);
  });

  it('refuses an excuses field that is no list, or that names a folder or a pattern, naming the field (PRD 2898)', () => {
    for (const excuses of ['kit/lib/x.ts', '[]', '[kit/lib/]', '[kit/**/x.ts]', '[/abs/x.ts]', '[../x.ts]', '[a, a]']) {
      expect(firstIssue(OutboxItemFrontMatterSchema, { ...item, excuses })?.path, excuses).toEqual(['excuses']);
    }
  });
});

describe('excusePathProblem (PRD 2898)', () => {
  it('passes one exact path from the repository root', () => {
    for (const path of ['kit/lib/init/labels.ts', 'README.md', '.github/workflows/checks.yml', 'a/b-c_d.e.test.ts']) expect(excusePathProblem(path), path).toBeNull();
  });

  it('names a folder, a pattern, a path outside the root and one with a space or a comma', () => {
    expect(excusePathProblem('kit/lib/')).toBe('kit/lib/ is a folder: an item excuses exact paths only');
    expect(excusePathProblem('kit/*.ts')).toBe('kit/*.ts is a pattern: an item excuses exact paths only');
    for (const path of ['kit/?.ts', 'kit/{a,b}.ts', 'kit/[ab].ts', '!kit/a.ts']) expect(excusePathProblem(path), path).toMatch(/is a pattern/);
    expect(excusePathProblem('/kit/a.ts')).toBe('/kit/a.ts is not a path from the repository root');
    expect(excusePathProblem('kit/../a.ts')).toBe('kit/../a.ts is not a path from the repository root');
    expect(excusePathProblem('./a.ts')).toBe('./a.ts is not a path from the repository root');
    expect(excusePathProblem('a b.ts')).toBe('a b.ts holds a space or a comma: one path per --excuses');
    expect(excusePathProblem('')).toBe('an empty path');
  });
});

describe('AccountFrontMatterSchema', () => {
  it('reads an account', () => {
    expect(AccountFrontMatterSchema.parse({ prd: '725', slice: 's3', graded: '2026-10-01' })).toEqual({ prd: 725, slice: 's3', graded: '2026-10-01' });
  });

  it('refuses a prd that is not a number, naming it', () => {
    const issue = firstIssue(AccountFrontMatterSchema, { prd: 'x', slice: 's3', graded: '2026-10-01' });
    expect(issue?.path).toEqual(['prd']);
    expect(issue?.message).toBe('prd must be a number');
  });
});
