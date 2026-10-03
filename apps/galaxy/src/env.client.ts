/**
 * **The arcade's environment, in the browser** (PRD 1059): the two public values a client component
 * reads, the galaxy's Supabase address and its publishable key. Next inlines `process.env.NEXT_PUBLIC_*`
 * into the browser bundle at build only where it is written literally, so these are the arcade's only
 * literal reads, and nothing else in the browser reads the environment.
 *
 * The pair is read as on the server (`./env.ts`): both set, or `null` (the demo, a closed build); one
 * without the other, or an address that is not a URL, is an {@link EnvError} naming the variables and
 * never a value. The server's startup parse (`instrumentation.ts`) refuses the same build first. No
 * zod here: the check is two lines, and the home page ships as little JavaScript as it can.
 */
import { EnvError, type EnvSource } from 'vertuo-omni-plan/kit/lib/env/group.ts';

/** The galaxy's Supabase as the browser reaches it. */
export type PublicSupabase = { url: string; key: string };

const URL_VAR = 'NEXT_PUBLIC_SUPABASE_URL';
const KEY_VAR = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

/** The public pair from `source`: both set, or null when neither is; throws an `EnvError` otherwise. */
export function readClientEnv(source: EnvSource): { supabase: PublicSupabase | null } {
  const url = source[URL_VAR]?.trim() || undefined;
  const key = source[KEY_VAR]?.trim() || undefined;
  if (url === undefined && key === undefined) return { supabase: null };
  if (url === undefined || key === undefined) {
    const [unset, given] = url === undefined ? [URL_VAR, KEY_VAR] : [KEY_VAR, URL_VAR];
    throw new EnvError([{ variables: [given, unset], reason: `${unset} is not set while ${given} is (the Supabase public pair: set all of them, or none)` }]);
  }
  if (!URL.canParse(url)) throw new EnvError([{ variables: [URL_VAR], reason: `${URL_VAR} is not valid: a URL` }]);
  return { supabase: { url, key } };
}

let parsed: { supabase: PublicSupabase | null } | undefined;

/** The browser's environment, read once: the values `next build` inlined. */
export function clientEnv(): { supabase: PublicSupabase | null } {
  parsed ??= readClientEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed;
}
