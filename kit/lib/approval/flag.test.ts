// The phase-0 flag reader (PRD 1299, item s7-01): `server` or `pr` from the repository's row on the
// Omni page, and `pr` with why whenever it cannot be read.
import { describe, expect, it } from 'vitest';
import { AskCallError } from '../ask/client.ts';
import { flagReading } from './flag.ts';

describe('flagReading', () => {
  it('reads server and pr as the page answers them', async () => {
    expect(await flagReading(() => Promise.resolve({ phase0: 'server' }))).toEqual({ flag: 'server', why: null });
    expect(await flagReading(() => Promise.resolve({ phase0: 'pr' }))).toEqual({ flag: 'pr', why: null });
  });

  it('falls back to pr, saying why, on an answer that is no flag', async () => {
    expect(await flagReading(() => Promise.resolve({ phase0: 'maybe' }))).toEqual({ flag: 'pr', why: 'malformed reply' });
    expect(await flagReading(() => Promise.resolve(null))).toEqual({ flag: 'pr', why: 'malformed reply' });
  });

  it('falls back to pr when the page refuses or does not answer', async () => {
    expect(await flagReading(() => Promise.reject(new AskCallError('x', { status: 403 })))).toEqual({ flag: 'pr', why: 'refused (403)' });
    expect(await flagReading(() => Promise.reject(new AskCallError('x')))).toEqual({ flag: 'pr', why: 'unreachable' });
  });

  it('lets an error that is not a call error through', async () => {
    await expect(flagReading(() => Promise.reject(new TypeError('bug')))).rejects.toThrow('bug');
  });
});
