// PRD 725, s18: the shapes the status line reads from outside the process. Each is lenient where the
// status line must never fail, and names the field when a value cannot be read at all.
import { describe, expect, it } from 'vitest';
import { BoardFileSchema, LockFileSchema, SessionRecordSchema, StatusInputSchema } from './schema.ts';

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((issue) => issue.path.join('.'));

describe('StatusInputSchema', () => {
  it('reads the fields it shows, and any field of the wrong kind as null', () => {
    const parsed = StatusInputSchema.parse({
      model: { display_name: 'Opus 5.5' },
      context_window: { used_percentage: '58' },
      rate_limits: { five_hour: { used_percentage: 10, resets_at: 'soon' } },
      workspace: [],
      session_id: 7,
    });
    expect(parsed).toEqual({
      model: { display_name: 'Opus 5.5' },
      context_window: { used_percentage: null },
      rate_limits: { five_hour: { used_percentage: 10, resets_at: 'soon' } },
      workspace: null,
      cwd: null,
      session_id: null,
    });
  });

  it('refuses a value that is not a JSON object', () => {
    expect(StatusInputSchema.safeParse([]).success).toBe(false);
    expect(StatusInputSchema.safeParse(null).success).toBe(false);
  });
});

describe('SessionRecordSchema', () => {
  it('reads a record, its time as null when it is not text', () => {
    expect(SessionRecordSchema.parse({ prd: 7, at: '2026-09-28T12:00:00.000Z' })).toEqual({ prd: 7, at: '2026-09-28T12:00:00.000Z' });
    expect(SessionRecordSchema.parse({ prd: 7, at: 42 })).toEqual({ prd: 7, at: null });
  });

  it('names the PRD when it is not a positive whole number', () => {
    for (const prd of [0, -3, 2.5, '7', undefined]) expect(issuePaths(SessionRecordSchema.safeParse({ prd }))).toEqual(['prd']);
  });
});

describe('BoardFileSchema', () => {
  it('reads slices, keeping only their id, wave and state', () => {
    expect(BoardFileSchema.parse({ at: 'x', slices: [{ id: 's1', wave: 1, state: 'merged', title: 'extra' }] })).toEqual({
      at: 'x',
      slices: [{ id: 's1', wave: 1, state: 'merged' }],
    });
  });

  it('reads slices it cannot read, and an error that is not text, as absent', () => {
    expect(BoardFileSchema.parse({ at: 'x', slices: [{ id: 's1', wave: '1', state: 'merged' }], error: 3 })).toEqual({ at: 'x' });
  });

  it('names the time when it is missing', () => {
    expect(issuePaths(BoardFileSchema.safeParse({ slices: [] }))).toEqual(['at']);
  });
});

describe('LockFileSchema', () => {
  it('reads its time and owner, each absent when it is not text', () => {
    expect(LockFileSchema.parse({ at: 'x', owner: 'me' })).toEqual({ at: 'x', owner: 'me' });
    expect(LockFileSchema.parse({ at: 5, owner: null })).toEqual({});
  });
});
