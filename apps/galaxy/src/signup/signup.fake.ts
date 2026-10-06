// A stubbed GitHub and database for the sign-up tests (PRD 359): the App's view of installations,
// each visitor's GitHub account, and the rows create_workspace_from_installation() and
// signup_requests keep, applying the same rules as supabase/migrations/20261001090000_github_sign_up.sql.
import { vi } from 'vitest';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { GithubAccount } from '../data/github-orgs';
import type { LinkPort, SignedIn, SignInDeps } from '../data/sign-in';
import type { Installation, SignupDeps, WorkspaceMade } from './installation';

export const TOKEN = 'gho_the-sign-in-token';

type Ws = { id: string; slug: string; github_org: string; github_installation_id: number | null };
type Member = { workspace_id: string; user_id: string; role: 'owner' | 'member' };

export function signupWorld(opts: {
  accounts: Record<string, GithubAccount>;
  installations?: Installation[];
  workspaces?: Ws[];
  members?: Member[];
  requests?: { user_id: string; github_org: string }[];
}) {
  const installations = [...(opts.installations ?? [])];
  const workspaces = [...(opts.workspaces ?? [])];
  const members = [...(opts.members ?? [])];
  const requests = [...(opts.requests ?? [])];
  const state: { githubDown: boolean; dbDown: boolean } = { githubDown: false, dbDown: false };
  let next = 1;

  const github = () => { if (state.githubDown) throw new Error('GitHub answered 502 to /app/installations'); };
  const db = () => { if (state.dbDown) throw new Error('Supabase: timeout'); };
  /** `run`'s answer as a promise, as an async function gives it: a throw becomes a rejection. */
  const settled = <T>(run: () => T): Promise<T> => new Promise((resolve) => {
    resolve(run());
  });

  // `satisfies`, not a type: a test reads each mock as a property, not as a method of SignupDeps.
  const signup = {
    installation: vi.fn((id: number) => settled(() => { github(); return installations.find((i) => i.id === id) ?? null; })),
    orgInstallation: vi.fn((org: string) => settled(() => {
      github();
      return installations.find((i) => i.account.type === 'Organization' && i.account.login.toLowerCase() === org.toLowerCase()) ?? null;
    })),
    userInstallation: vi.fn((login: string) => settled(() => {
      github();
      return installations.find((i) => i.account.type === 'User' && i.account.login.toLowerCase() === login.toLowerCase()) ?? null;
    })),
    createWorkspace: vi.fn((userId: string, inst: Installation): Promise<WorkspaceMade> => settled(() => {
      db();
      let ws = workspaces.find((w) => w.github_installation_id === inst.id)
        ?? workspaces.find((w) => w.github_org.toLowerCase() === inst.account.login.toLowerCase());
      let created = false;
      if (ws && ws.github_installation_id === null) ws.github_installation_id = inst.id;
      if (!ws) {
        ws = { id: `ws-${next++}`, slug: inst.account.login.toLowerCase(), github_org: inst.account.login, github_installation_id: inst.id };
        workspaces.push(ws);
        created = true;
      }
      const id = ws.id;
      if (!members.some((m) => m.workspace_id === id && m.user_id === userId)) {
        members.push({ workspace_id: id, user_id: userId, role: created ? 'owner' : 'member' });
      }
      const role = defined(members.find((m) => m.workspace_id === id && m.user_id === userId), 'the member just added').role;
      return { workspaceId: id, slug: ws.slug, role, created };
    })),
    pendingRequests: vi.fn((userId: string) => settled(() => { db(); return requests.filter((r) => r.user_id === userId).map((r) => r.github_org); })),
    recordRequest: vi.fn((userId: string, org: string) => settled(() => {
      db();
      if (!requests.some((r) => r.user_id === userId && r.github_org === org)) requests.push({ user_id: userId, github_org: org });
    })),
    dropRequest: vi.fn((userId: string, org: string) => settled(() => {
      db();
      const at = requests.findIndex((r) => r.user_id === userId && r.github_org === org);
      if (at >= 0) requests.splice(at, 1);
    })),
  } satisfies SignupDeps;

  // Each visitor's token is `<TOKEN>:<their user id>`; any other is refused, as an expired one is.
  const readGithub = vi.fn((token: string) => settled(() => {
    const [head, who] = token.split(':');
    if (state.githubDown) throw new Error('GitHub answered 502 to /user');
    if (head === TOKEN && who && opts.accounts[who]) return opts.accounts[who];
    throw new Error('GitHub answered 401 to /user');
  }));
  const joinByGithub = vi.fn((userId: string, logins: string[]) => settled(() => {
    const wanted = new Set(logins.map((l) => l.toLowerCase()));
    for (const w of workspaces) {
      if (w.github_installation_id !== null && wanted.has(w.github_org.toLowerCase())
        && !members.some((m) => m.workspace_id === w.id && m.user_id === userId)) {
        members.push({ workspace_id: w.id, user_id: userId, role: 'member' });
      }
    }
    // As join_workspaces_by_github() answers: the slugs of every workspace the person belongs to.
    return members.filter((m) => m.user_id === userId)
      .map((m) => workspaces.find((w) => w.id === m.workspace_id)?.slug)
      .filter((slug): slug is string => Boolean(slug));
  }));
  const linkGithub = vi.fn(() => Promise.resolve({ data: { github_login: 'linked' }, error: null }));

  const deps: SignInDeps & { signup: SignupDeps } = { readGithub, joinByGithub, signup };
  /** The session of one visitor: `userId` signed in as the GitHub account `accounts[userId]`. */
  const session = (userId: string, token: string | null = `${TOKEN}:${userId}`): SignedIn => ({ user: { id: userId }, provider_token: token });
  const rpc: LinkPort = { rpc: linkGithub };

  return { deps, signup, session, db: rpc, linkGithub, joinByGithub, readGithub, workspaces, members, requests, installations, state };
}
