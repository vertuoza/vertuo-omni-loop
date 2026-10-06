import 'server-only';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { githubClient, type GithubClient } from '@omni/github';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import { githubStore } from '../dossier/github/server';
import { installationSettingsUrl, reachedRepositories } from '../signup/github-app';
import type { Installation } from '../signup/installation';
import type { Product } from '../business/model';
import { rowOf, type RepositoryRow, type StoredRepository } from './model';
import type { Access } from './RepositoriesView';

// Settings → Repositories's read (PRD 612 s1). As the signed-in person, so row-level security decides
// what it returns: their workspace (the one joined first, as /app's), its repositories, whether they
// own it (is_owner()), and its GitHub org and installation. Then, as the Omni App, through galaxy's own
// App client: the installation (the one the workspace stored, else the App's installation on its
// GitHub account, as the knowledge map finds it), and the repositories it can see. A role that cannot
// be read reads as a member's; an installation or a listing that cannot be read leaves the page
// without Add repository's offer and without the no-access marks, never without its list. PRD 748 s4
// adds each repository's product and the business's products, as the signed-in person too; products
// that cannot be read leave the page without its product selects, never without its list. PRD 902 s6:
// the repositories the installation reaches are read with its token through the shared, budget-aware
// client, `interactive` (the person waits on the page), on the budget the whole server shares; a paused
// budget reads as a listing that cannot be read.

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
    /** The business's products, first first (PRD 748 s4); a select shows from the second on. */
    products: Product[];
    access: Access;
  };

async function ownerOf(db: SupabaseClient<Database>, workspace: string): Promise<boolean> {
  // `data` is widened to unknown: is_owner's answer is read here unparsed, so only a true is an owner.
  const { data, error }: { data: unknown; error: Error | null } = await db.rpc('is_owner', { workspace });
  if (error) throw error;
  return data === true;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

/** A role that cannot be read reads as a member's. */
function asMember(err: unknown): boolean {
  console.error(`repositories: your role could not be read (${why(err)})`);
  return false;
}

async function rowsOf(db: SupabaseClient<Database>, workspace: string): Promise<RepositoryRow[]> {
  // `data` is widened to null: the rows are read here unparsed.
  const { data, error }: { data: StoredRepository[] | null; error: Error | null } = await db
    .from('repositories')
    .select('full_name, tracked, collected_at, collect_error, product_id')
    .eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase: could not read the repositories (${error.message})`);
  return (data ?? []).map(rowOf);
}

type GithubOf = { github_org: string | null; github_installation_id: number | string | null };

async function githubOf(db: SupabaseClient<Database>, workspace: string): Promise<GithubOf> {
  // `data` is widened to null: the row is read here unparsed.
  const { data, error }: { data: GithubOf | null; error: Error | null } =
    await db.from('workspaces').select('github_org, github_installation_id').eq('id', workspace).maybeSingle();
  if (error) throw new Error(`Supabase: could not read the workspace's GitHub installation (${error.message})`);
  return data ?? { github_org: null, github_installation_id: null };
}

/** The business's products, first first (PRD 748 s4). None when there is no business yet. */
async function productsOf(db: SupabaseClient<Database>, workspace: string): Promise<Product[]> {
  // `data` is widened to null: the rows are read here unparsed.
  const { data, error }: { data: Product[] | null; error: Error | null } = await db.from('products').select('id, name').eq('workspace_id', workspace).order('ordinal');
  if (error) throw error;
  return (data ?? []).map(({ id, name }) => ({ id, name }));
}

/** Products that cannot be read: the page then shows no product select, never no list. */
function noProducts(err: unknown): Product[] {
  console.error(`repositories: the products could not be read (${why(err)})`);
  return [];
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
  let products: Product[];
  try {
    workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    [repositories, owner, github, products] = await Promise.all([
      rowsOf(db, workspace.id), ownerOf(db, workspace.id).catch(asMember), githubOf(db, workspace.id), productsOf(db, workspace.id).catch(noProducts),
    ]);
  } catch (err) {
    console.error(`repositories: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
  const access = await accessOf(github, app, installUrl, client);
  return { kind: 'repositories', workspace: { id: workspace.id, name: workspace.name }, owner, repositories, access, products };
}
