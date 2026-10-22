import { describe, expect, it } from 'vitest';
import { decodeCursor, decodeLinesCursor, encodeCursor, encodeLinesCursor, type Cursor, type LinesCursor } from './cursor';

// The /api/v1 lists' cursor (PRD 2022 s2): the base64url of the last row's (created_at, id), tagged with
// its list, read back as a keyset. Anything that does not decode to one of ours reads as no cursor, which
// the controller answers 422. A job's lines page by the same kind of cursor (PRD 2425 s4), keyed by the
// last line's sequence number and tagged with the job.

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

describe('a job’s lines cursor (PRD 2425 s4)', () => {
  const JOB = '0b4c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3';
  const OTHER = '1c4d2e3f-4051-4b6c-9d7e-8f90a1b2c3d4';
  const LINE: LinesCursor = { job: JOB, seq: 50 };
  const forged = (value: unknown) => decodeLinesCursor(b64(JSON.stringify(value)), JOB);

  it('reads back what it wrote, for the job it was written for', () => {
    expect(decodeLinesCursor(encodeLinesCursor(LINE), JOB)).toEqual(LINE);
    const last: LinesCursor = { job: JOB, seq: 2_147_483_647 };
    expect(decodeLinesCursor(encodeLinesCursor(last), JOB)).toEqual(last);
  });

  it('is opaque and safe in an address: base64url, no padding', () => {
    expect(encodeLinesCursor(LINE)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses a cursor of another job’s lines, so a page never reads on in a job it was not made for', () => {
    expect(decodeLinesCursor(encodeLinesCursor(LINE), OTHER)).toBeNull();
  });

  it('refuses a cursor of the PRD list or the bug-fix list, and the lists refuse this one', () => {
    expect(decodeLinesCursor(encodeCursor(LAST), JOB)).toBeNull();
    expect(decodeLinesCursor(encodeCursor({ ...LAST, list: 'bug-fixes' }), JOB)).toBeNull();
    expect(decodeCursor(encodeLinesCursor(LINE), 'prds')).toBeNull();
    expect(decodeCursor(encodeLinesCursor(LINE), 'bug-fixes')).toBeNull();
  });

  it('refuses a tampered cursor', () => {
    const cursor = encodeLinesCursor(LINE);
    expect(decodeLinesCursor(`${cursor.slice(0, -3)}AAA`, JOB)).toBeNull();
    expect(decodeLinesCursor(`${cursor}!`, JOB)).toBeNull();
    expect(decodeLinesCursor('', JOB)).toBeNull();
    expect(decodeLinesCursor('not a cursor', JOB)).toBeNull();
    expect(decodeLinesCursor('A'.repeat(1000), JOB)).toBeNull();
  });

  it('refuses a sequence number that is not a whole number from 1 to the largest the database holds', () => {
    expect(forged(['lines', JOB, 1])).toEqual({ job: JOB, seq: 1 });
    for (const seq of [0, -1, 1.5, 2_147_483_648, '50', null, '50 or true']) expect(forged(['lines', JOB, seq]), String(seq)).toBeNull();
  });

  it('refuses a cursor that is not exactly its list, its job and a sequence number', () => {
    expect(forged(['lines', JOB])).toBeNull();
    expect(forged(['lines', JOB, 50, 'extra'])).toBeNull();
    expect(forged({ list: 'lines', job: JOB, seq: 50 })).toBeNull();
    expect(forged(['lines', 'not a job', 50])).toBeNull();
    expect(forged(['lines', JOB, 50])).toEqual(LINE);
  });
});
