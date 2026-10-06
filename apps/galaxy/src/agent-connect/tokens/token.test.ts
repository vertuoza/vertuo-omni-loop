import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashToken, isTokenShaped, makeToken, TOKEN_PREFIX } from './token';

// An agent's link (PRD 855, decision 9): `omb_` and 32 random bytes in base64url, shown once; only its
// SHA-256 (hex) and its last four characters are kept.

describe('makeToken', () => {
  it('draws omb_ and 32 random bytes in base64url, with its hash and last four', async () => {
    const made = await makeToken();
    expect(made.token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(made.token).toMatch(/^omb_[A-Za-z0-9_-]{43}$/);
    expect(made.hash).toBe(createHash('sha256').update(made.token).digest('hex'));
    expect(made.lastFour).toBe(made.token.slice(-4));
  });

  it('never draws the same token twice', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add((await makeToken()).token);
    expect(seen.size).toBe(50);
  });

  it('reads its bytes from the source it is given', async () => {
    const made = await makeToken((bytes) => bytes.fill(0));
    expect(made.token).toBe(`omb_${'A'.repeat(43)}`);
  });
});

describe('hashToken', () => {
  it('is the SHA-256 of the token, in hex', async () => {
    expect(await hashToken('omb_abc')).toBe(createHash('sha256').update('omb_abc').digest('hex'));
  });
});

describe('isTokenShaped', () => {
  it('takes a token as made, and nothing else', async () => {
    expect(isTokenShaped((await makeToken()).token)).toBe(true);
    for (const bad of ['', 'omb_', 'omb_short', `xyz_${'A'.repeat(43)}`, `omb_${'A'.repeat(43)} `, `omb_${'+'.repeat(43)}`]) {
      expect(isTokenShaped(bad), bad).toBe(false);
    }
  });
});
