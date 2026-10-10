import 'server-only';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { githubClient, type GithubClient } from '@omni/github';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import { githubStore } from '../dossier/github/server';
import { installationSettingsUrl, reachedRepositories } from '../signup/github-app';
import type { Installation } from '../signup/installation';
import { rowOf, type RepositoryProduct, type RepositoryRow } from './model';
import { repositoriesRepository, type GithubOf, type StoredProductLink } from './repositories.repository';
import type { Access } from './RepositoriesView';

// Settings → Repositories's read (PRD 612 s1). As the signed-in person, so row-level security decides
// what it returns: their workspace (the one joined first, as /app's), its repositories, whether they
// own it (is_owner()), and its GitHub org and installation. Then, as the Omni App, through galaxy's own
// App client: the installation (the one the workspace stored, else the App's installation on its
// GitHub account, as the knowledge map finds it), and the repositories it can see. A role that cannot
// be read reads as a member's; an installation or a listing that cannot be read leaves the page
// without Add repository's offer and without the no-access marks, never without its list. PRD 1364 s11
// reads the products that link each repository (product_repositories), as the signed-in person too;
// products that cannot be read leave the page without its chips, never without its list. The reads
// themselves are repositories.repository.ts's (ADR-0095). PRD 902 s6:
// the repositories the installation reaches are read with its token through the shared, budget-aware
// client, `interactive` (the person waits on the page), on the budget the whole server shares; a paused
// budget reads as a listing that cannot be read. PRD 1246 s4 reads whether each repository's ideas
// board is public. PRD 1299 s1 reads where each repository's phase 0 is approved.

/** What the page asks GitHub as the Omni App, with its JWT (src/signup/github-app.ts). */
export interface RepositoriesApp {
  installation(id: number): Promise<Installation | null>;
  orgInstallation(org: string): Promise<Installation | null>;
  userInstallation(login: string): Promise<Installation | null>;
  installationToken(id: number): Promise<{ token: string }>;
}

let shared: GithubClient | undefined;
/** The server's client on the shared store, made at its first call. */
const sharedGithub = (): GithubClient => (shared ??= githubClient({ store: githubStore() }));

export type RepositoriesLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | {
    kind: 'repositories';
    workspace: { id: string; name: string };
    owner: boolean;
    repositories: RepositoryRow[];
    access: Access;
  };

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

/** A role that cannot be read reads as a member's. */
function asMember(err: unknown): boolean {
  console.error(`repositories: your role could not be read (${why(err)})`);
  return false;
}

/** Each repository's products, by `owner/name`, first first (PRD 1364 s11). A link to a product the
 * workspace does not list is left out. */
function productsByRepository(products: readonly RepositoryProduct[], links: readonly StoredProductLink[]): Map<string, RepositoryProduct[]> {
  const linked = new Map<string, Set<string>>();
  for (const l of links) linked.set(l.repository.toLowerCase(), (linked.get(l.repository.toLowerCase()) ?? new Set()).add(l.product_id));
  const byRepository = new Map<string, RepositoryProduct[]>();
  for (const [repository, ids] of linked) byRepository.set(repository, products.filter((p) => ids.has(p.id)));
  return byRepository;
}

/** Products or links that cannot be read: the page then shows no chip, never no list. */
async function productsOf(store: ReturnType<typeof repositoriesRepository>, workspace: string): Promise<Map<string, RepositoryProduct[]>> {
  try {
    const [products, links] = await Promise.all([store.products(workspace), store.links(workspace)]);
    return productsByRepository(products, links);
  } catch (err) {
    console.error(`repositories: the products could not be read (${why(err)})`);
    return new Map();
  }
}

/** The workspace's installation: its stored id's, else its org's or the person's own. */
async function installationOf(github: GithubOf, stored: number | null, app: RepositoriesApp): Promise<Installation | null> {
  if (stored) return app.installation(stored);
  if (!github.github_org) return null;
  return (await app.orgInstallation(github.github_org)) ?? (await app.userInstallation(github.github_org));
}

/** The repositories the installation reaches, or null when GitHub could not say. */
async function reachableOf(app: RepositoriesApp, github: GithubClient, installation: Installation): Promise<string[] | null> {
  try {
    const { token } = await app.installationToken(installation.id);
    return await reachedRepositories(token, github.bound({ installation: installation.id, priority: 'interactive' }));
  } catch (err) {
    console.error(`repositories: the Omni App's repositories could not be read (${why(err)})`);
    return null;
  }
}

const unreadInstalled = (): Access => ({ kind: 'installed', settingsUrl: null, reachable: null });

async function accessOf(github: GithubOf, app: RepositoriesApp | null, installUrl: string | null, client: GithubClient): Promise<Access> {
  const stored = github.github_installation_id === null ? null : Number(github.github_installation_id);
  if (!app) return stored ? unreadInstalled() : { kind: 'none', installUrl };
  let installation: Installation | null = null;
  try {
    installation = await installationOf(github, stored, app);
  } catch (err) {
    console.error(`repositories: the Omni App installation could not be read (${why(err)})`);
    if (stored) return unreadInstalled();
  }
  if (!installation) return { kind: 'none', installUrl };
  return { kind: 'installed', settingsUrl: installationSettingsUrl(installation), reachable: await reachableOf(app, client, installation) };
}

export async function loadRepositoriesPage(
  db: SupabaseClient<Database>,
  user: User,
  app: RepositoriesApp | null,
  installUrl: string | null,
  client: GithubClient = sharedGithub(),
): Promise<RepositoriesLoad> {
  let workspace;
  let repositories: RepositoryRow[];
  let owner: boolean;
  let github: GithubOf;
  const store = repositoriesRepository(db);
  try {
    workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const [rows, isOwner, githubRow, products] = await Promise.all([
      store.rows(workspace.id), store.owner(workspace.id).catch(asMember), store.github(workspace.id), productsOf(store, workspace.id),
    ]);
    repositories = rows.map((r) => rowOf(r, products.get(r.full_name.toLowerCase()) ?? []));
    owner = isOwner;
    github = githubRow;
  } catch (err) {
    console.error(`repositories: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
  const access = await accessOf(github, app, installUrl, client);
  return { kind: 'repositories', workspace: { id: workspace.id, name: workspace.name }, owner, repositories, access };
}
