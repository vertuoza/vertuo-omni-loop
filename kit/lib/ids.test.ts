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
  parsePrdId,
  parseProductPrdId,
  parseProductRoadmapId,
  productRoadmapId,
  productRoadmapParts,
  ProductRoadmapIdSchema,
  isProductPrdId,
  productPrdParts,
  type ProductPrdId,
  ProductPrdIdSchema,
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

describe('parsePrdId — a PRD of a repository (12) or of a product (mobile-12), PRD 1548', () => {
  it('reads a number as a repository PRD, as parsePrd does', () => {
    expect(parsePrdId('12')).toBe(12);
    expect(parsePrdId(12)).toBe(12);
    expect(isProductPrdId(parsePrdId('12'))).toBe(false);
  });

  it('reads <key>-<n> as a product PRD, its key kebab-case', () => {
    expect(parsePrdId('mobile-12')).toBe('mobile-12');
    expect(parsePrdId('field-app-3')).toBe('field-app-3');
    expect(parsePrdId('v2-1')).toBe('v2-1');
    expect(isProductPrdId(parsePrdId('mobile-12'))).toBe(true);
  });

  it.each([
    'mobile', '12-mobile', 'Mobile-12', 'mobile-0', 'mobile-012', 'mobile-', '-12', 'mobile--12', 'mobile-12a', '2fa-1', 'mobile-12-',
    ' mobile-12', '', '0', `mobile-${2 ** 31}`,
  ])('refuses %j by name', (value) => {
    expect(() => parsePrdId(value)).toThrow(`PRD ${JSON.stringify(value)}: a PRD is its number (12) or its product's key and its number (mobile-12)`);
  });

  it('splits a product PRD into its key and its number, the key itself kebab-case with hyphens', () => {
    expect(productPrdParts(parseProductPrdId('mobile-12'))).toEqual({ key: 'mobile', seq: 12 });
    expect(productPrdParts(parseProductPrdId('field-app-3'))).toEqual({ key: 'field-app', seq: 3 });
    expect(productPrdParts(parseProductPrdId(`a-${2 ** 31 - 1}`))).toEqual({ key: 'a', seq: 2 ** 31 - 1 });
  });

  it('parseProductPrdId refuses a plain number, which is a repository PRD', () => {
    expect(() => parseProductPrdId('12')).toThrow('product PRD "12": ');
    expect(ProductPrdIdSchema.safeParse('mobile-12').success).toBe(true);
    expectTypeOf(parseProductPrdId('mobile-12')).toEqualTypeOf<ProductPrdId>();
    expectTypeOf(parsePrdId('mobile-12')).toEqualTypeOf<PrdNumber | ProductPrdId>();
  });

  it('a key of 40 characters and no more', () => {
    const forty = `a${'b'.repeat(39)}`;
    expect(parsePrdId(`${forty}-1`)).toBe(`${forty}-1`);
    expect(() => parsePrdId(`${forty}b-1`)).toThrow('PRD ');
  });
});

describe('a product roadmap id — <key>-R<n>, PRD 2011', () => {
  it('reads the key and the number', () => {
    expect(productRoadmapParts(parseProductRoadmapId('mobile-R3'))).toEqual({ key: 'mobile', seq: 3 });
    expect(productRoadmapParts(parseProductRoadmapId('field-app-R12'))).toEqual({ key: 'field-app', seq: 12 });
    expect(productRoadmapId('mobile', 4)).toBe('mobile-R4');
  });

  it('is told from a product PRD, a plain number and a malformed id', () => {
    expect(ProductRoadmapIdSchema.safeParse('mobile-12').success).toBe(false);
    expect(ProductRoadmapIdSchema.safeParse('mobile-r3').success).toBe(false);
    expect(ProductRoadmapIdSchema.safeParse('mobile-R0').success).toBe(false);
    expect(ProductRoadmapIdSchema.safeParse('R3').success).toBe(false);
    expect(ProductRoadmapIdSchema.safeParse('12').success).toBe(false);
    expect(ProductPrdIdSchema.safeParse('mobile-R3').success).toBe(false);
    expect(ProductRoadmapIdSchema.safeParse(`a-R${2 ** 31}`).success).toBe(false);
    expect(() => parseProductRoadmapId('mobile-12')).toThrow('product roadmap "mobile-12"');
  });
});
