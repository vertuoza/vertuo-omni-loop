// The workspace a signed-in person plays in (supabase/migrations/20260926120000_workspaces.sql), read
// as that person: row-level security hands them their own memberships and the workspaces they belong
// to, nothing else. Crew is membership, never an email domain: at sign-in, galaxy's server makes a
// person a member of the workspaces of their GitHub orgs (join_workspaces_by_github(), PRD 359). A
// person may belong to several workspaces; until switching comes (PRD 2), the arcade plays the one
// they joined first, by joined_at, then slug.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Brand } from '../arcade/brand';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  /** Only the colours the workspace overrides, token to `#rrggbb`: `{}` for none. */
  theme: Record<string, string>;
}

type MembershipRow = { joined_at: string; workspace: { id: string; slug: string; name: string; theme: unknown } | null };

/** The stored theme's string entries: the database checks it (valid_theme()); the arcade checks
 * each colour again before applying it. */
const themeOf = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : {};

/** The workspace the person joined first, or null when they belong to none. */
export async function firstWorkspace(db: SupabaseClient, userId: string): Promise<Workspace | null> {
  const { data, error } = await db
    .from('workspace_members')
    .select('joined_at, workspace:workspaces(id, slug, name, theme)')
    .eq('user_id', userId);
  if (error) throw new Error(`Supabase: could not read your workspaces (${error.message})`);
  const first = ((data ?? []) as unknown as MembershipRow[])
    .filter((m): m is MembershipRow & { workspace: NonNullable<MembershipRow['workspace']> } => m.workspace !== null)
    .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at) || a.workspace.slug.localeCompare(b.workspace.slug))[0];
  if (!first) return null;
  const { id, slug, name, theme } = first.workspace;
  return { id, slug, name, theme: themeOf(theme) };
}

/** A workspace as GitHub knows it: its org, and the omni-loop App installation it owns. */
export interface WorkspaceGithub { slug: string; github_org: string | null; github_installation_id: number | null }

type GithubRow = { workspace: WorkspaceGithub | null };

/** Every workspace the person belongs to, with its GitHub org and installation, by slug: where the
 * knowledge map finds the repositories it may offer them. */
export async function memberGithub(db: SupabaseClient, userId: string): Promise<WorkspaceGithub[]> {
  const { data, error } = await db
    .from('workspace_members')
    .select('workspace:workspaces(slug, github_org, github_installation_id)')
    .eq('user_id', userId);
  if (error) throw new Error(`Supabase: could not read your workspaces (${error.message})`);
  return ((data ?? []) as unknown as GithubRow[])
    .flatMap((row) => (row.workspace ? [{
      slug: row.workspace.slug,
      github_org: row.workspace.github_org ?? null,
      github_installation_id: row.workspace.github_installation_id === null ? null : Number(row.workspace.github_installation_id),
    }] : []))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Adds the person to every workspace, with an installation, whose GitHub org is one of `logins`
 * (idempotent); the slugs of the workspaces they belong to, the one joined first first. `db` is the
 * service role's client: only it may run join_workspaces_by_github(). */
export async function joinByGithub(db: Pick<SupabaseClient, 'rpc'>, userId: string, logins: string[]): Promise<string[]> {
  const { data, error } = await db.rpc('join_workspaces_by_github', { p_user_id: userId, p_logins: logins });
  if (error) throw new Error(`Supabase: could not join your workspaces (${error.message})`);
  return (data ?? []) as string[];
}

/** The workspace the person plays in, or null. Joining happens at sign-in only, where GitHub's token
 * is at hand (src/data/sign-in.ts): one who belongs to none signs in again, or signs up. */
export async function memberWorkspace(db: SupabaseClient, userId: string): Promise<Workspace | null> {
  return firstWorkspace(db, userId);
}

/** Where a sign-in lands: the arcade for a member of a workspace, sign-up for anyone in none (PRD
 * 359), so a newcomer goes straight on to installing Omni Loop. A failed read lands on the arcade,
 * which says so itself. */
export async function landingAfterSignIn(db: SupabaseClient, userId: string): Promise<'/play' | '/signup'> {
  try {
    return (await firstWorkspace(db, userId)) ? '/play' : '/signup';
  } catch (err) {
    console.error(`auth callback: ${err instanceof Error ? err.message : String(err)}`);
    return '/play';
  }
}

/** Whose arcade it is: the workspace's name and colours. */
export const brandOf = ({ name, theme }: Workspace): Brand => ({ name, theme });
