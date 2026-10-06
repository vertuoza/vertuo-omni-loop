import 'server-only';
import { installUrl } from '../../src/signup/github-app';
import { readView, SignupScreen } from '../../src/signup/SignupScreen';
import { serverEnv } from '../../src/env';

// /signup (PRD 359): where a visitor with no workspace installs Omni Loop on their GitHub org (or
// their own account), and where /signup/installed sends them when they must wait for their org's
// owner, or when a sign-up stopped. It reads no session: installing signs them in again anyway.
// Rendered per request (it reads its query): the install link comes from the server's GITHUB_APP_SLUG.

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function SignupPage({ searchParams }: Props) {
  const query = await searchParams;
  const view = readView({ waiting: one(query.waiting), error: one(query.error) });
  return <SignupScreen view={view} installUrl={installUrl(serverEnv().githubAppSlug)} />;
}
