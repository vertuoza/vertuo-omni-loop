import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { AccountFrontMatterSchema, OutboxItemFrontMatterSchema, SpecFrontMatterSchema } from './front-matter.ts';
import { KIT_MESSAGES } from './messages.ts';

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

  it('refuses an unknown rank and a bad date, naming each', () => {
    const rank = firstIssue(OutboxItemFrontMatterSchema, { ...item, rank: 'low' });
    expect(rank?.path).toEqual(['rank']);
    expect(rank?.message).toBe('rank must be one of: human-action, high, medium');
    const raised = firstIssue(OutboxItemFrontMatterSchema, { ...item, raised: 'yesterday' });
    expect(raised?.path).toEqual(['raised']);
    expect(raised?.message).toBe('raised must be a YYYY-MM-DD date');
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
