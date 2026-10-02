// The token store the ask client reads by default: the sign-in `omni signin` keeps in
// `~/.config/omni/credentials.json` (mode 0600), keyed by the host of `ask.url`, each entry the token
// exchange's own reply (`{ access_token, refresh_token, expires_at, email }`). It lives in the
// person's home, never in a repository, since one sign-in serves every checkout.
//
// The hooks only read it, and write it back when a 401 made them refresh the token.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
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

export function homeTokens({ home = homedir() }: { home?: string } = {}): TokenStore {
  const file = join(home, ...FILE);
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
