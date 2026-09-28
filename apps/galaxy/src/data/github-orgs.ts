// Who a person is on GitHub, as far as joining needs it (PRD 359): their login and the logins of
// their orgs, read once at sign-in with the provider token GitHub handed Supabase (the `read:org`
// scope shows private memberships too), and never stored. The joining rule itself is pure: a person
// joins every workspace whose GitHub org is one of those logins, in any case, and that has an
// installation of the App. The database applies the same rule (join_workspaces_by_github(),
// supabase/migrations/20261001090000_github_sign_up.sql); this module is its statement in code, for
// the tests and the fakes.
import { z } from 'zod';

export interface GithubAccount {
  login: string;
  orgs: string[];
}

export interface JoinableWorkspace {
  github_org: string | null;
  github_installation_id: number | null;
}

/** The logins a person joins by: their own, then their orgs', each once whatever its case. */
export function joinLogins({ login, orgs }: GithubAccount): string[] {
  const seen = new Set<string>();
  return [login, ...orgs].filter((l) => {
    const key = l.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The workspaces those logins join: one with an installation, whose GitHub org is among them. */
export function workspacesToJoin<W extends JoinableWorkspace>(logins: string[], workspaces: W[]): W[] {
  const wanted = new Set(logins.map((l) => l.toLowerCase()));
  return workspaces.filter((w) => w.github_installation_id !== null && w.github_org !== null && wanted.has(w.github_org.toLowerCase()));
}

const GITHUB = 'https://api.github.com';
const Login = z.object({ login: z.string().min(1) });
const Orgs = z.array(Login);

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

async function get<T>(fetchImpl: Fetch, token: string, path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetchImpl(`${GITHUB}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} to ${path}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new Error(`GitHub's answer to ${path} is not the shape it documents`);
  return parsed.data;
}

/** The signed-in person's login and org logins. Throws when GitHub refuses or answers oddly. Reads
 * the first hundred orgs: joining past them waits for a later need. */
export async function readGithubAccount(token: string, fetchImpl: Fetch = fetch): Promise<GithubAccount> {
  const { login } = await get(fetchImpl, token, '/user', Login);
  const orgs = await get(fetchImpl, token, '/user/orgs?per_page=100', Orgs);
  return { login, orgs: orgs.map((o) => o.login) };
}
