import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { API_KEY_PREFIX, hashApiKey, isApiKeyShaped, makeApiKey } from './secret';

// An API key's secret (PRD 2022 s1): `oma_` and 32 random bytes in base64url, of which only the SHA-256
// and the last four characters are kept.

const counting = (bytes: Uint8Array) => bytes.map((_, i) => i);

describe('an API key’s secret', () => {
  it('is oma_ and 32 random bytes in base64url, 47 characters in all', async () => {
    const made = await makeApiKey();
    expect(made.secret.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(made.secret).toMatch(/^oma_[A-Za-z0-9_-]{43}$/);
    expect(made.secret).toHaveLength(47);
  });

  it('draws its bytes from the fill it is given, one for each of the 32', async () => {
    let asked = 0;
    const made = await makeApiKey((bytes) => { asked = bytes.length; return counting(bytes); });
    expect(asked).toBe(32);
    expect(made.secret).toBe(`oma_${Buffer.from(counting(new Uint8Array(32))).toString('base64url')}`);
  });

  it('is new each time', async () => {
    const [a, b] = await Promise.all([makeApiKey(), makeApiKey()]);
    expect(a.secret).not.toBe(b.secret);
  });

  it('keeps its SHA-256 in hex and its last four characters, the secret itself never', async () => {
    const made = await makeApiKey();
    expect(made.hash).toBe(createHash('sha256').update(made.secret).digest('hex'));
    expect(made.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(made.lastFour).toBe(made.secret.slice(-4));
    expect(made.lastFour).toMatch(/^[A-Za-z0-9_-]{4}$/);
  });

  it('hashes a secret sent back as the database stored it', async () => {
    const made = await makeApiKey();
    expect(await hashApiKey(made.secret)).toBe(made.hash);
  });

  it('knows its shape, so anything else is never looked up', async () => {
    const { secret } = await makeApiKey();
    expect(isApiKeyShaped(secret)).toBe(true);
    for (const other of ['', 'oma_', `omb_${secret.slice(4)}`, `${secret}x`, secret.slice(0, -1), ` ${secret}`, `oma_${'+'.repeat(43)}`]) {
      expect(isApiKeyShaped(other), other).toBe(false);
    }
  });
});
