// An agent's link to the business (PRD 855, decision 9): `omb_` followed by 32 random bytes in
// base64url. It is shown once; only its SHA-256, in hex, and its last four characters are stored
// (supabase/migrations/20261028090000_agent_tokens.sql). Web Crypto, so the server and the demo page
// draw tokens the same way.

export const TOKEN_PREFIX = 'omb_';
const TOKEN_BYTES = 32;
const TOKEN_SHAPE = /^omb_[A-Za-z0-9_-]{43}$/;

export interface MadeToken {
  /** The token itself: shown once, never stored. */
  token: string;
  /** Its SHA-256, 64 hex characters: what the database keeps and checks. */
  hash: string;
  /** Its last four characters, for the list. */
  lastFour: string;
}

/** Fills `bytes` with random values. */
export type RandomFill = (bytes: Uint8Array) => Uint8Array;

const fillRandom: RandomFill = (bytes) => globalThis.crypto.getRandomValues(bytes);

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The SHA-256 of `token`, in hex. */
export async function hashToken(token: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Whether `value` has the shape of a token as made: anything else is never looked up. */
export const isTokenShaped = (value: string) => TOKEN_SHAPE.test(value);

export async function makeToken(fill: RandomFill = fillRandom): Promise<MadeToken> {
  const token = TOKEN_PREFIX + base64url(fill(new Uint8Array(TOKEN_BYTES)));
  return { token, hash: await hashToken(token), lastFour: token.slice(-4) };
}
