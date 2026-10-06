import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { positiveInt } from '../bin/args.ts';
import {
  type CommentId,
  CommentIdSchema,
  type IssueNumber,
  IssueNumberSchema,
  type OutboxItemId,
  OutboxItemIdSchema,
  parseCommentId,
  parseIssue,
  parseOutboxItemId,
  parsePr,
  parsePrd,
  parseSliceId,
  parseWorkSliceId,
  type PrdNumber,
  PrdNumberSchema,
  type PrNumber,
  PrNumberSchema,
  type SliceId,
  SliceIdSchema,
  type WorkSliceId,
} from './ids.ts';

const NUMERIC = [
  ['parseIssue', parseIssue, 'issue number'],
  ['parsePrd', parsePrd, 'PRD number'],
  ['parsePr', parsePr, 'pull request number'],
  ['parseCommentId', parseCommentId, 'comment id'],
] as const;

describe.each(NUMERIC)('%s — a positive integer, or the digit string of one', (_name, parse, what) => {
  it('accepts a positive integer and gives it back unchanged', () => {
    expect(parse(1)).toBe(1);
    expect(parse(1049)).toBe(1049);
  });

  it('accepts a digit string, as a number', () => {
    expect(parse('7')).toBe(7);
    expect(parse('007')).toBe(7);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '0', '-1', '1.5', '12a', '', ' 7', 's1'])('refuses %j, naming the kind and the value', (value) => {
    expect(() => parse(value)).toThrow(new RegExp(`^${what} ${JSON.stringify(value).replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}: `));
  });

  it('accepts every digit string positiveInt accepts', () => {
    for (const value of ['1', '9', '10', '42', '0042', '1049', '99999', String(Number.MAX_SAFE_INTEGER)]) {
      expect(parse(value)).toBe(positiveInt('test', 'it', value));
    }
  });
});

describe('parseSliceId — s and a number', () => {
  it('accepts s1 and s12', () => {
    expect(parseSliceId('s1')).toBe('s1');
    expect(parseSliceId('s12')).toBe('s12');
  });

  it.each(['s', 'S1', '1', 's1a', ' s1', 's-1', ''])('refuses %j, naming the value', (value) => {
    expect(() => parseSliceId(value)).toThrow(`slice id ${JSON.stringify(value)}: `);
  });
});

describe('parseWorkSliceId — a plan slice, a rework or the settling of a ledger', () => {
  it.each(['s1', 's12', 'fix-s1-01-migration-after-ask-mode', 'settle'])('accepts %j', (value) => {
    expect(parseWorkSliceId(value)).toBe(value);
  });

  it.each(['', 'S1', 'fix-', '-s1', 'fix--s1', 's 1'])('refuses %j, naming the value', (value) => {
    expect(() => parseWorkSliceId(value)).toThrow(`slice ${JSON.stringify(value)}: `);
  });

  it('a plan slice fits where a work slice is expected, not the reverse', () => {
    expectTypeOf<SliceId>().toExtend<WorkSliceId>();
    expectTypeOf<WorkSliceId>().not.toExtend<SliceId>();
  });
});

describe('parseOutboxItemId — the slice, a two-digit count and a slug', () => {
  it('accepts an item id', () => {
    expect(parseOutboxItemId('s1-01-untracked-files-not-linted')).toBe('s1-01-untracked-files-not-linted');
    expect(parseOutboxItemId('s12-03-zod')).toBe('s12-03-zod');
  });

  it('accepts an item a rework raised, its slice the rework', () => {
    const id = 'fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace';
    expect(parseOutboxItemId(id)).toBe(id);
  });

  it.each(['s1-01', 's1-01-', 's1-1-zod', 'S1-01-zod', 's1-01-Zod', 's1-01-zod-', 's1-01--zod', 's-01-zod', ''])('refuses %j, naming the value', (value) => {
    expect(() => parseOutboxItemId(value)).toThrow(`outbox item id ${JSON.stringify(value)}: `);
  });
});

describe('the schemas — for use inside other schemas', () => {
  it('brand the fields of an object they read', () => {
    const Row = z.object({ prd: PrdNumberSchema, pr: PrNumberSchema, issue: IssueNumberSchema, comment: CommentIdSchema, slice: SliceIdSchema, item: OutboxItemIdSchema });
    const row = Row.parse({ prd: 7, pr: 8, issue: 9, comment: 10, slice: 's1', item: 's1-01-zod' });
    expect(row).toEqual({ prd: 7, pr: 8, issue: 9, comment: 10, slice: 's1', item: 's1-01-zod' });
    expectTypeOf(row.prd).toEqualTypeOf<PrdNumber>();
    expectTypeOf(row.slice).toEqualTypeOf<SliceId>();
    expect(Row.safeParse({ prd: 0, pr: 8, issue: 9, comment: 10, slice: 's1', item: 's1-01-zod' }).success).toBe(false);
  });
});

describe('the brands — one kind never passes for another', () => {
  const takesIssue = (issue: IssueNumber) => issue;
  const takesPrd = (prd: PrdNumber) => prd;
  const takesPr = (pr: PrNumber) => pr;
  const takesComment = (comment: CommentId) => comment;
  const takesSlice = (slice: SliceId) => slice;
  const takesItem = (item: OutboxItemId) => item;

  it('each parser gives its own brand', () => {
    expectTypeOf(parseIssue(1)).toEqualTypeOf<IssueNumber>();
    expectTypeOf(parsePrd(1)).toEqualTypeOf<PrdNumber>();
    expectTypeOf(parsePr(1)).toEqualTypeOf<PrNumber>();
    expectTypeOf(parseCommentId(1)).toEqualTypeOf<CommentId>();
    expectTypeOf(parseSliceId('s1')).toEqualTypeOf<SliceId>();
    expectTypeOf(parseOutboxItemId('s1-01-zod')).toEqualTypeOf<OutboxItemId>();
  });

  it('a PRD number fits where an issue number is expected, not the reverse', () => {
    expectTypeOf<PrdNumber>().toExtend<IssueNumber>();
    expectTypeOf<IssueNumber>().not.toExtend<PrdNumber>();
    takesIssue(parsePrd(1));
    // @ts-expect-error an issue is not a PRD
    takesPrd(parseIssue(1));
  });

  it('a pull request number fits neither a PRD nor an issue', () => {
    expectTypeOf<PrNumber>().not.toExtend<PrdNumber>();
    expectTypeOf<PrNumber>().not.toExtend<IssueNumber>();
    expectTypeOf<PrdNumber>().not.toExtend<PrNumber>();
    expectTypeOf<CommentId>().not.toExtend<PrNumber>();
    // @ts-expect-error a pull request is not a PRD
    takesPrd(parsePr(1));
    // @ts-expect-error a PRD is not a pull request
    takesPr(parsePrd(1));
    // @ts-expect-error a comment is not a pull request
    takesPr(parseCommentId(1));
  });

  it('a plain number or string fits none', () => {
    expectTypeOf<number>().not.toExtend<IssueNumber>();
    expectTypeOf<number>().not.toExtend<PrdNumber>();
    expectTypeOf<number>().not.toExtend<PrNumber>();
    expectTypeOf<number>().not.toExtend<CommentId>();
    expectTypeOf<string>().not.toExtend<SliceId>();
    expectTypeOf<string>().not.toExtend<OutboxItemId>();
    // @ts-expect-error a plain number is no issue
    takesIssue(1);
    // @ts-expect-error a plain number is no comment
    takesComment(1);
    // @ts-expect-error a plain string is no slice
    takesSlice('s1');
    // @ts-expect-error a plain string is no item
    takesItem('s1-01-zod');
    // @ts-expect-error a slice is not an item
    takesItem(parseSliceId('s1'));
  });

  it('a branded value is still its number or string', () => {
    expectTypeOf<PrdNumber>().toExtend<number>();
    expectTypeOf<SliceId>().toExtend<string>();
    expect(parsePrd(7) + 1).toBe(8);
  });
});
