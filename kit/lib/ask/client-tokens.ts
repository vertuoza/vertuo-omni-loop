// The token store the ask client reads by default: the sign-in `omni signin` keeps in
// `~/.config/omni/credentials.json` (mode 0600), keyed by the host of `ask.url`, each entry the token
// exchange's own reply (`{ access_token, refresh_token, expires_at, email }`). It lives in the
// person's home, never in a repository, since one sign-in serves every checkout.
//
// The hooks only read it, and write it back when a 401 made them refresh the token.
//
// With `OMNI_TOKEN` set (PRD 1628), the store is the kit token's instead, and wins over the file: it
// holds the access token the client trades the kit token for, in memory only, and never reads or
// writes the file. The token itself is never written anywhere.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { processOmniToken } from '../env/read.ts';
import type { TokenStore } from './client.ts';
import { jsonObject, TokensSchema } from './schema.ts';
import type { JsonObject, Tokens } from './schema.ts';

const FILE = ['.config', 'omni', 'credentials.json'];

function readAll(file: string): JsonObject {
  try {
    return jsonObject(JSON.parse(readFileSync(file, 'utf8'))) ?? {};
  } catch {
    return {};
  }
}

/** The part of a kit token the kit ever shows: its last four characters. */
export const omniTokenTail = (token: string): string => token.slice(-4);

/**
 * What the kit token's store answers before its first trade: an entry, so that every command reads
 * it as signed in, whose access token is empty and long expired, so that the client trades first.
 */
const NOT_TRADED_YET: Tokens = { access_token: '', expires_at: 0 };

/** The store of the kit token `token`: the access tokens it is traded for, kept in memory only. */
function omniTokenStore(token: string): TokenStore {
  const held = new Map<string, Tokens>();
  return {
    omniToken: token,
    read: (host: string): Tokens => held.get(host) ?? NOT_TRADED_YET,
    write(host: string, tokens: Tokens): void {
      held.set(host, tokens);
    },
  };
}

/**
 * The sign-in of `home`, or the kit token's when there is one. `omniToken` is the `OMNI_TOKEN` group's
 * value (`null`: unset); left out, it is read from this process's environment when `home` is too,
 * since the real home goes with the real environment, and a test's home with the test's own.
 */
export function homeTokens({ home, omniToken }: { home?: string | undefined; omniToken?: string | null | undefined } = {}): TokenStore {
  const token = omniToken !== undefined ? omniToken : home === undefined ? processOmniToken() : null;
  if (token !== null) return omniTokenStore(token);
  const file = join(home ?? homedir(), ...FILE);
  return {
    read(host: string): Tokens | null {
      const entry = TokensSchema.safeParse(readAll(file)[host]);
      return entry.success ? entry.data : null;
    },
    write(host: string, tokens: Tokens): void {
      const all = { ...readAll(file), [host]: tokens };
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      writeFileSync(file, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 });
      chmodSync(file, 0o600);
    },
  };
}
