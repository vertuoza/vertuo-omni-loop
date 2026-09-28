// /signup/installed (PRD 359): where GitHub sends a visitor after they install the omni-loop App, or
// ask their org's owner to. The address alone is never trusted: /signup/installed signs the visitor
// in with GitHub again (it is silent: they already granted the scopes), so its callback holds a fresh
// provider token, and finishSetup() then
//   - install: reads who the visitor is on GitHub (their login and orgs, once, never stored), fetches
//     the installation with the App's JWT, checks it is on their own account or on an org they belong
//     to, and makes it a workspace (create_workspace_from_installation(), the service role's);
//   - request: GitHub names no org, so it records a sign-up request for each of the visitor's orgs
//     that has no installation yet. Their next sign-in, once an owner has installed the App on one,
//     finishes it (completeRequests() in src/data/sign-in.ts).
// Joining by org and linking GitHub run as at every sign-in (ADR 0044: best effort).
import { joinLogins, type GithubAccount } from '../data/github-orgs';
import { linkGithub, type SignedIn, type SignInDeps } from '../data/sign-in';
import { ownsInstallation, type SignupDeps } from './installation';

export type Setup = { action: 'install'; installationId: number } | { action: 'request' };

/** Why a sign-up stopped: each has its own screen (src/signup/SignupScreen.tsx). */
export const SETUP_ERRORS = ['link', 'github', 'unknown', 'not-yours', 'no-org', 'failed', 'closed'] as const;
export type SetupError = (typeof SETUP_ERRORS)[number];

export type SetupOutcome =
  | { kind: 'workspace'; slug: string; role: 'owner' | 'member'; created: boolean }
  | { kind: 'waiting'; orgs: string[] }
  | { kind: 'error'; reason: SetupError };

/** The setup GitHub's address names, or null when it is not one GitHub sends. `update` (the
 * installation's repositories changed) is read as an installation: making the workspace is
 * idempotent. */
export function readSetup(params: URLSearchParams): Setup | null {
  const action = params.get('setup_action');
  if (action === 'request') return { action: 'request' };
  if (action !== 'install' && action !== 'update') return null;
  const raw = params.get('installation_id') ?? '';
  if (!/^[1-9][0-9]{0,15}$/.test(raw)) return null;
  const installationId = Number(raw);
  return Number.isSafeInteger(installationId) ? { action: 'install', installationId } : null;
}

/** The setup, as query parameters again: carried through the GitHub sign-in to its callback. */
export function setupQuery(setup: Setup): URLSearchParams {
  return setup.action === 'request'
    ? new URLSearchParams({ setup_action: 'request' })
    : new URLSearchParams({ installation_id: String(setup.installationId), setup_action: 'install' });
}

type Rpc = Parameters<typeof linkGithub>[0];
type Deps = SignInDeps & { signup: SignupDeps };

const log = (err: unknown) => console.error(`sign-up: ${err instanceof Error ? err.message : String(err)}`);
const error = (reason: SetupError): SetupOutcome => ({ kind: 'error', reason });

async function whoOnGithub(session: SignedIn, deps: Deps): Promise<GithubAccount | null> {
  if (!session.provider_token) { log('no GitHub token came back with this sign-in'); return null; }
  try { return await deps.readGithub(session.provider_token); } catch (err) { log(err); return null; }
}

async function install(userId: string, account: GithubAccount, installationId: number, deps: Deps): Promise<SetupOutcome> {
  let found;
  try { found = await deps.signup.installation(installationId); } catch (err) { log(err); return error('github'); }
  if (!found) return error('unknown');
  if (!ownsInstallation(account, found)) return error('not-yours');
  try {
    const { slug, role, created } = await deps.signup.createWorkspace(userId, found);
    return { kind: 'workspace', slug, role, created };
  } catch (err) { log(err); return error('failed'); }
}

async function request(userId: string, account: GithubAccount, deps: Deps): Promise<SetupOutcome> {
  const orgs: string[] = [];
  try {
    for (const org of account.orgs) if (!(await deps.signup.orgInstallation(org))) orgs.push(org);
  } catch (err) { log(err); return error('github'); }
  if (orgs.length === 0) return error('no-org');
  try {
    for (const org of orgs) await deps.signup.recordRequest(userId, org);
  } catch (err) { log(err); return error('failed'); }
  return { kind: 'waiting', orgs };
}

/** Finishes a sign-up for the visitor who just signed in again with GitHub. Never throws. */
export async function finishSetup(db: Rpc, session: SignedIn, setup: Setup, deps: Deps): Promise<SetupOutcome> {
  const account = await whoOnGithub(session, deps);
  if (!account) return error('github');
  const userId = session.user.id;
  try { await deps.joinByGithub(userId, joinLogins(account)); } catch (err) { log(err); }
  const outcome = setup.action === 'install'
    ? await install(userId, account, setup.installationId, deps)
    : await request(userId, account, deps);
  const linked = await linkGithub(db);
  if (linked.error !== null) log(linked.error);
  return outcome;
}

/** Where the visitor goes next: the arcade once they are in a workspace, else /signup's screen. */
export function setupReturn(outcome: SetupOutcome, origin: string): URL {
  if (outcome.kind === 'workspace') return new URL('/play', origin);
  const url = new URL('/signup', origin);
  if (outcome.kind === 'waiting') url.searchParams.set('waiting', outcome.orgs.join(','));
  else url.searchParams.set('error', outcome.reason);
  return url;
}
