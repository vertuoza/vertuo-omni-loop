// The kit's error words survive the move to Zod 4 (PRD 725, s3): a schema's default message reads
// as it did under Zod 3, so `omni`'s output does not change with the library.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { KIT_MESSAGES } from './messages.ts';

const message = (schema: z.ZodType, value: unknown): string | undefined =>
  schema.safeParse(value, { error: KIT_MESSAGES }).error?.issues[0]?.message;

describe('the kit messages', () => {
  it('says Required for a missing value, and what it expected otherwise', () => {
    expect(message(z.object({ title: z.string() }), {})).toBe('Required');
    expect(message(z.string(), 5)).toBe('Expected string, received number');
    expect(message(z.string(), null)).toBe('Expected string, received null');
    expect(message(z.object({}), [])).toBe('Expected object, received array');
    expect(message(z.coerce.number(), 'x')).toBe('Expected number, received nan');
    expect(message(z.number().int(), 1.5)).toBe('Expected integer, received float');
  });

  it('words a size the way Zod 3 did', () => {
    expect(message(z.string().min(2), 'a')).toBe('String must contain at least 2 character(s)');
    expect(message(z.string().max(1), 'ab')).toBe('String must contain at most 1 character(s)');
    expect(message(z.array(z.string()).min(1), [])).toBe('Array must contain at least 1 element(s)');
    expect(message(z.array(z.string()).max(1), ['a', 'b'])).toBe('Array must contain at most 1 element(s)');
    expect(message(z.number().positive(), 0)).toBe('Number must be greater than 0');
    expect(message(z.number().min(1), 0)).toBe('Number must be greater than or equal to 1');
    expect(message(z.number().max(1), 2)).toBe('Number must be less than or equal to 1');
    expect(message(z.number().lt(1), 1)).toBe('Number must be less than 1');
  });

  it('names the values an enum or a literal takes, and the keys an object refuses', () => {
    expect(message(z.enum(['a', 'b']), 'c')).toBe("Invalid enum value. Expected 'a' | 'b', received 'c'");
    expect(message(z.literal(1), 2)).toBe('Invalid literal value, expected 1');
    expect(message(z.object({}).strict(), { x: 1, y: 2 })).toBe("Unrecognized key(s) in object: 'x', 'y'");
    expect(message(z.number().multipleOf(2), 3)).toBe('Number must be a multiple of 2');
  });

  it('words a format, a union and a refinement the way Zod 3 did', () => {
    expect(message(z.string().regex(/a/), 'b')).toBe('Invalid');
    expect(message(z.string().url(), 'b')).toBe('Invalid url');
    expect(message(z.string().datetime(), 'b')).toBe('Invalid datetime');
    expect(message(z.union([z.string(), z.number()]), true)).toBe('Invalid input');
    expect(message(z.string().refine(() => false), 'a')).toBe('Invalid input');
    const kinds = z.discriminatedUnion('kind', [z.object({ kind: z.literal('a') }), z.object({ kind: z.literal('b') })]);
    expect(message(kinds, { kind: 'c' })).toBe("Invalid discriminator value. Expected 'a' | 'b'");
  });

  it('never overrides a message the schema names itself', () => {
    expect(message(z.string().min(1, 'title is required'), '')).toBe('title is required');
    expect(message(z.enum(['a'], { message: 'kind must be a' }), 'b')).toBe('kind must be a');
  });
});
