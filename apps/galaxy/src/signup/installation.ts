// What sign-up reaches outside galaxy (PRD 359): GitHub, as the omni-loop App sees it with its own
// JWT, and the service role's two sign-up writes, create_workspace_from_installation() and the
// signup_requests table (supabase/migrations/20261001090000_github_sign_up.sql). The live ones are in
// src/data/sign-in-live.ts, server only; the tests stub them (signup.fake.ts).
import type { GithubAccount } from '../data/github-orgs';

/** An installation of the omni-loop App, as GitHub answers it: its id and the account it is on. */
export interface Installation {
  id: number;
  account: { login: string; type: 'Organization' | 'User' };
}

/** What create_workspace_from_installation() answers: the workspace, the person's role in it, and
 * whether it is new. */
export interface WorkspaceMade {
  workspaceId: string;
  slug: string;
  role: 'owner' | 'member';
  created: boolean;
}

export interface SignupDeps {
  /** The installation with that id, fetched with the App's JWT; null when GitHub knows none. Throws
   * when GitHub answers an error. */
  installation(id: number): Promise<Installation | null>;
  /** The App's installation on that org; null when it has none. Throws when GitHub answers an error. */
  orgInstallation(org: string): Promise<Installation | null>;
  createWorkspace(userId: string, installation: Installation): Promise<WorkspaceMade>;
  /** The orgs the person asked to have Omni Loop installed on, still waiting. */
  pendingRequests(userId: string): Promise<string[]>;
  recordRequest(userId: string, org: string): Promise<void>;
  dropRequest(userId: string, org: string): Promise<void>;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Whether the person may make a workspace of the installation: it is on their own account, or on an
 * org they belong to. GitHub logins are unique whatever their case. */
export function ownsInstallation({ login, orgs }: GithubAccount, { account }: Installation): boolean {
  return account.type === 'User' ? same(account.login, login) : orgs.some((o) => same(o, account.login));
}

/** Whether the person belongs to the org, as GitHub reads it now. */
export const belongsTo = ({ login, orgs }: GithubAccount, org: string) => same(login, org) || orgs.some((o) => same(o, org));
