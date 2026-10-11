import type { Metadata } from 'next';
import { CliSignInCard } from '../../../src/ask/cli-code-card';
import { cliCallbackPath, readCliSignIn } from '../../../src/ask/cli-code';
import { readTokenRequest, tokenCallbackPath } from '../../../src/ask/kit-token';
import { Notice } from '../../../src/ask/page/Notice';
import { supabaseEnv } from '../../../src/data/supabase-server';

// /ask/signin?port=<p>&state=<s>: the page `omni signin` opens. The person signs in with Google here,
// and the auth callback's ask-cli branch sends the terminal's loopback address a one-time code
// (src/ask/cli-code.ts). A refused sign-in comes back here with its reason, and nothing reaches the
// terminal. Rendered per request.
// With `purpose=token` (PRD 1628), the same sign-in makes a kit token, for `omni setup-token` or for
// Make a token on a profile page (src/ask/kit-token.ts).

export const metadata: Metadata = { title: 'Sign the terminal in · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function AskCliSignInPage({ searchParams }: Props) {
  const query = await searchParams;
  const params = new URLSearchParams(Object.entries(query).flatMap(([key, value]) => {
    const first = one(value);
    return first === null ? [] : [[key, first]];
  }));
  const asksToken = params.get('purpose') === 'token';
  const tokenRequest = asksToken ? readTokenRequest(params, new Date()) : null;
  const signIn = asksToken ? null : readCliSignIn(params);
  const env = supabaseEnv();
  const error = params.get('signin_error');

  if (signIn && env) return <CliSignInCard supabase={env} returnPath={cliCallbackPath(signIn)} error={error} />;
  if (tokenRequest && env) {
    const purpose = { kind: 'token' as const, name: tokenRequest.name, days: tokenRequest.days, toTerminal: !('back' in tokenRequest.to) };
    return <CliSignInCard supabase={env} returnPath={tokenCallbackPath(tokenRequest)} error={error} purpose={purpose} />;
  }
  if (signIn || tokenRequest) {
    return (
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot sign a terminal in.</p>
      </Notice>
    );
  }
  return (
    <Notice title="This sign-in link is not complete">
      <p className="ask-muted">
        {asksToken
          ? <>Run <code>omni setup-token</code> again, or make the token from your profile page.</>
          : <>Run <code>omni signin</code> in the terminal again: it opens this page with the address to come back to.</>}
      </p>
    </Notice>
  );
}
