// What the auth callback (app/auth/callback/route.ts) does once Google's or GitHub's code is a
// session: every sign-in joins the workspaces of the account's confirmed email domain
// (join_by_domain()), before anything that needs a workspace — link_github() in the arcade's
// return, ask_cli_code_issue() in the terminal's (`omni signin`). Joining is best effort: a failure
// is logged, the page joins once more itself, and what needs a workspace refuses with its own
// message.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CliCallbackDeps, CliSession } from '../ask/cli-code';
import { joinByDomain } from './workspace';

type Rpc = Pick<SupabaseClient, 'rpc'>;

/** The query-string entry the arcade reads on its return (readReturn() in src/arcade/onboarding.ts). */
export type SignInReturn = ['signin', 'ok'] | ['linked', string] | ['link_error', string];

async function join(run: () => Promise<unknown>) {
  try { await run(); } catch (err) { console.error(`auth callback: ${(err as Error).message}`); }
}

/** After a sign-in (`next` null) or a GitHub link (`next` 'link'): join, then link when asked. */
export async function afterSignIn(db: Rpc, next: string | null): Promise<SignInReturn> {
  await join(() => joinByDomain(db));
  if (next !== 'link') return ['signin', 'ok'];
  const { data, error } = await db.rpc('link_github');
  if (error) return ['link_error', error.message];
  return ['linked', (data as { github_login?: string } | null)?.github_login ?? ''];
}

/** The terminal's sign-in steps, joining as the new sign-in before its one-time code is issued. */
export function joinBeforeIssue(deps: CliCallbackDeps, joinAs: (session: CliSession) => Promise<unknown>): CliCallbackDeps {
  return {
    ...deps,
    async issue(session, codeHash) {
      await join(() => joinAs(session));
      return deps.issue(session, codeHash);
    },
  };
}
