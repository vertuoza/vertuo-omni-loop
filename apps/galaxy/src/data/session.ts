// The session a sign-in hands back (PRD 359), parsed where it comes in (PRD 1030): exchangeCodeForSession()
// answers it to both GitHub callbacks (app/auth/callback, app/signup/installed/callback), which read
// whose it is and GitHub's token, as joining needs them (src/data/sign-in.ts).
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { z } from 'zod';
import { orNull, parseRow } from './parse-rows';

/** The new session, as far as joining needs it: whose it is, and GitHub's token when Supabase handed one.
 * Not strict: a session carries its tokens and its user's every field, and joining reads these two. */
const SignedInSession = z.object({ user: z.object({ id: z.string() }), provider_token: z.string().nullish() });
export type SignedIn = z.infer<typeof SignedInSession>;

/** The session of exchangeCodeForSession()'s answer, parsed; null when it carried none, or one that
 * does not parse (logged by `where`, never its values). */
export function sessionOf(data: unknown, where: string): SignedIn | null {
  const session = propertyOf(data, 'session');
  if (session === null || session === undefined) return null;
  return orNull(parseRow(SignedInSession, session, where));
}
