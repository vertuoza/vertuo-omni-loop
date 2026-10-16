import { base64url, hashToken, type RandomFill } from '../../agent-connect/tokens/token';

// An API key's secret (PRD 2022 s1): `oma_` followed by 32 random bytes in base64url, drawn on the
// server. It is shown once, to the owner who made it, in the answer that made it; only its SHA-256, in
// hex, and its last four characters are stored (supabase/migrations/20261210090000_api_keys.sql). The
// /api/v1 routes hash the bearer they are sent the same way, and look up only a secret of this shape.

export const API_KEY_PREFIX = 'oma_';
const API_KEY_BYTES = 32;
const API_KEY_SHAPE = /^oma_[A-Za-z0-9_-]{43}$/;

export interface MadeApiKey {
  /** The secret itself: shown once, never stored. */
  secret: string;
  /** Its SHA-256, 64 hex characters: what the database keeps and checks. */
  hash: string;
  /** Its last four characters, for the list. */
  lastFour: string;
}

const fillRandom: RandomFill = (bytes) => globalThis.crypto.getRandomValues(bytes);

/** The SHA-256 of a secret, in hex: what api_key_of() is asked with. */
export const hashApiKey = (secret: string): Promise<string> => hashToken(secret);

/** Whether `value` has the shape of a secret as made. */
export const isApiKeyShaped = (value: string): boolean => API_KEY_SHAPE.test(value);

export async function makeApiKey(fill: RandomFill = fillRandom): Promise<MadeApiKey> {
  const secret = API_KEY_PREFIX + base64url(fill(new Uint8Array(API_KEY_BYTES)));
  return { secret, hash: await hashApiKey(secret), lastFour: secret.slice(-4) };
}
