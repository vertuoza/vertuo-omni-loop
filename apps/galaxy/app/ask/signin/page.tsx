import type { Metadata } from 'next';
import { CliSignInCard } from '../../../src/ask/cli-code-card';
import { cliCallbackPath, readCliSignIn } from '../../../src/ask/cli-code';
import { Notice } from '../../../src/ask/page/Notice';
import { supabaseEnv } from '../../../src/data/supabase-server';

// /ask/signin?port=<p>&state=<s>: the page `omni signin` opens. The person signs in with Google here,
// and the auth callback's ask-cli branch sends the terminal's loopback address a one-time code
// (src/ask/cli-code.ts). A refused sign-in comes back here with its reason, and nothing reaches the
// terminal. Rendered per request.

export const metadata: Metadata = { title: 'Sign the terminal in · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function AskCliSignInPage({ searchParams }: Props) {
  const query = await searchParams;
  const signIn = readCliSignIn(new URLSearchParams({ port: one(query.port) ?? '', state: one(query.state) ?? '' }));
  if (!signIn) {
    return (
      <Notice title="This sign-in link is not complete">
        <p className="ask-muted">
          Run <code>omni signin</code> in the terminal again: it opens this page with the address to come back to.
        </p>
      </Notice>
    );
  }
  const env = supabaseEnv();
  if (!env) {
    return (
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot sign a terminal in.</p>
      </Notice>
    );
  }
  return <CliSignInCard supabase={env} returnPath={cliCallbackPath(signIn)} error={one(query.signin_error)} />;
}
