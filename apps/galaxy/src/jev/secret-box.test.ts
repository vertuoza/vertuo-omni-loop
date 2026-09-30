import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MASTER_KEY_VAR, SecretBoxError, lastFour, masterKey, openSecret, sealSecret } from './secret-box';

// The secret box (PRD 812 s1, decision 7): a workspace's TypeSafe key, sealed with AES-256-GCM under
// the deployment's SECRETS_MASTER_KEY (32 bytes, base64), its last four kept in the clear.

const MASTER = randomBytes(32);
const OTHER = randomBytes(32);
const KEY = 'ts_live_0123456789abcdef1a2b';

/** A base64 string with one byte changed. */
function flip(b64: string): string {
  const bytes = Buffer.from(b64, 'base64');
  bytes[0] ^= 0xff;
  return bytes.toString('base64');
}

describe('sealSecret and openSecret', () => {
  it('opens what it sealed', () => {
    const sealed = sealSecret(KEY, MASTER);
    expect(sealed.ciphertext).not.toContain(KEY);
    expect(openSecret(sealed, MASTER)).toBe(KEY);
  });

  it('seals the same key differently each time (a fresh iv)', () => {
    const a = sealSecret(KEY, MASTER);
    const b = sealSecret(KEY, MASTER);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(Buffer.from(a.iv, 'base64')).toHaveLength(12);
  });

  it('refuses to open under a wrong master key', () => {
    expect(() => openSecret(sealSecret(KEY, MASTER), OTHER)).toThrow(SecretBoxError);
  });

  it('refuses a changed ciphertext, and a changed iv', () => {
    const sealed = sealSecret(KEY, MASTER);
    expect(() => openSecret({ ...sealed, ciphertext: flip(sealed.ciphertext) }, MASTER)).toThrow(SecretBoxError);
    expect(() => openSecret({ ...sealed, iv: flip(sealed.iv) }, MASTER)).toThrow(SecretBoxError);
    expect(() => openSecret({ ...sealed, ciphertext: '' }, MASTER)).toThrow(SecretBoxError);
  });

  it('keeps the last four characters, and nothing more', () => {
    expect(sealSecret(KEY, MASTER).lastFour).toBe('1a2b');
    expect(lastFour('  abc  ')).toBe('abc');
    expect(lastFour(KEY)).toBe('1a2b');
  });

  it('refuses a master key that is not 32 bytes', () => {
    expect(() => sealSecret(KEY, randomBytes(16))).toThrow(SecretBoxError);
  });
});

describe('masterKey', () => {
  it('reads SECRETS_MASTER_KEY as 32 bytes of base64', () => {
    expect(MASTER_KEY_VAR).toBe('SECRETS_MASTER_KEY');
    expect(masterKey({ SECRETS_MASTER_KEY: MASTER.toString('base64') })?.equals(MASTER)).toBe(true);
  });

  it('is null when the master key is missing', () => {
    expect(masterKey({})).toBeNull();
    expect(masterKey({ SECRETS_MASTER_KEY: '' })).toBeNull();
    expect(masterKey({ SECRETS_MASTER_KEY: '   ' })).toBeNull();
  });

  it('is null when it is not 32 bytes', () => {
    expect(masterKey({ SECRETS_MASTER_KEY: randomBytes(16).toString('base64') })).toBeNull();
    expect(masterKey({ SECRETS_MASTER_KEY: 'not base64 at all!' })).toBeNull();
  });
});
