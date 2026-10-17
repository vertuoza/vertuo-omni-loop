import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, type Cursor } from './cursor';

// The /api/v1 lists' cursor (PRD 2022 s2): the base64url of the last row's (created_at, id), tagged with
// its list, read back as a keyset. Anything that does not decode to one of ours reads as no cursor, which
// the controller answers 422.

const LAST: Cursor = { list: 'prds', createdAt: '2026-10-15T13:41:50.481234+00:00', id: '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3' };

const b64 = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('the cursor', () => {
  it('reads back what it wrote, for each list', () => {
    expect(decodeCursor(encodeCursor(LAST), 'prds')).toEqual(LAST);
    const bug: Cursor = { ...LAST, list: 'bug-fixes', createdAt: '2026-10-15T13:41:50Z' };
    expect(decodeCursor(encodeCursor(bug), 'bug-fixes')).toEqual(bug);
  });

  it('is opaque and safe in an address: base64url, no padding', () => {
    expect(encodeCursor(LAST)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('keeps the time exactly as the database wrote it, microseconds included', () => {
    expect(decodeCursor(encodeCursor(LAST), 'prds')?.createdAt).toBe('2026-10-15T13:41:50.481234+00:00');
  });

  it('refuses a cursor of the other list', () => {
    expect(decodeCursor(encodeCursor(LAST), 'bug-fixes')).toBeNull();
  });

  it('refuses a tampered cursor', () => {
    const cursor = encodeCursor(LAST);
    expect(decodeCursor(`${cursor.slice(0, -3)}AAA`, 'prds')).toBeNull();
    expect(decodeCursor(`${cursor}!`, 'prds')).toBeNull();
    expect(decodeCursor('', 'prds')).toBeNull();
    expect(decodeCursor('not a cursor', 'prds')).toBeNull();
    expect(decodeCursor('A'.repeat(1000), 'prds')).toBeNull();
  });

  it('refuses a cursor whose values could reach the query as anything but a time and an id', () => {
    const forged = (value: unknown) => decodeCursor(b64(JSON.stringify(value)), 'prds');
    expect(forged(['prds', '2026-10-15T13:41:50Z', 'x"),id.gt.(0'])).toBeNull();
    expect(forged(['prds', '2026-10-15T13:41:50Z,id.gt.0', LAST.id])).toBeNull();
    expect(forged(['prds', 'yesterday', LAST.id])).toBeNull();
    expect(forged(['prds', LAST.createdAt])).toBeNull();
    expect(forged(['prds', LAST.createdAt, LAST.id, 'extra'])).toBeNull();
    expect(forged({ list: 'prds', createdAt: LAST.createdAt, id: LAST.id })).toBeNull();
    expect(forged(['prds', LAST.createdAt, LAST.id])).toEqual(LAST);
  });
});
