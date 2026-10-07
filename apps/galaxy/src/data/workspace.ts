// The workspace a signed-in person plays in (supabase/migrations/20260926120000_workspaces.sql), read
// as that person: row-level security hands them their own memberships and the workspaces they belong
// to, nothing else. Crew is membership, never an email domain: at sign-in, galaxy's server makes a
// person a member of the workspaces of their GitHub orgs (join_workspaces_by_github(), PRD 359). A
// person may belong to several workspaces; until switching comes (PRD 2), the arcade plays the one
// they joined first, by joined_at, then slug.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { Brand } from '../arcade/brand';
import { z } from 'zod';
import { orThrow, parseRows } from './parse-rows';
import { listOf, numberOf } from './unparsed';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  /** Only the colours the workspace overrides, token to `#rrggbb`: `{}` for none. */
  theme: Record<string, string>;
}

/** The columns of a membership, with its workspace. */
export const MEMBERSHIP_COLUMNS = 'joined_at, workspace:workspaces(id, slug, name, theme)';

/** A membership as MEMBERSHIP_COLUMNS reads it. The theme is a JSON column, read through themeOf(). */
export const MembershipRow = z.strictObject({
  joined_at: z.string(),
  workspace: z.strictObject({ id: z.string(), slug: z.string(), name: z.string(), theme: z.unknown() }).nullable(),
});
type MembershipRow = z.infer<typeof MembershipRow>;

/** The stored theme's string entries: the database checks it (valid_theme()); the arcade checks
 * each colour again before applying it. */
const themeOf = (value: unknown): Record<string, string> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string'))
    : {};

/** The workspace the person joined first, or null when they belong to none. */
async function firstWorkspace(db: SupabaseClient<Database>, userId: string): Promise<Workspace | null> {
  const { data, error } = await db
    .from('workspace_members')
    .select(MEMBERSHIP_COLUMNS)
    .eq('user_id', userId);
  if (error) throw new Error(`Supabase: could not read your workspaces (${error.message})`);
  const first = orThrow(parseRows(MembershipRow, data, 'data/workspace: workspace_members'))
    .filter((m): m is MembershipRow & { workspace: NonNullable<MembershipRow['workspace']> } => m.workspace !== null)
    .sort((a, b) => Date.parse(a.joined_at) - Date.parse(b.joined_at) || a.workspace.slug.localeCompare(b.workspace.slug))[0];
  if (!first) return null;
  const { id, slug, name, theme } = first.workspace;
  return { id, slug, name, theme: themeOf(theme) };
}

/** A workspace as GitHub knows it: its org, and the omni-loop App installation it owns. */
export interface WorkspaceGithub { slug: string; github_org: string | null; github_installation_id: number | null }

/** Every workspace the person belongs to, with its GitHub org and installation, by slug: where the
 * knowledge map finds the repositories it may offer them. */
export async function memberGithub(db: SupabaseClient<Database>, userId: string): Promise<WorkspaceGithub[]> {
  const { data, error } = await db
    .from('workspace_members')
    .select('workspace:workspaces(slug, github_org, github_installation_id)')
    .eq('user_id', userId);
  if (error) throw new Error(`Supabase: could not read your workspaces (${error.message})`);
  // Each row is read as PostgREST sent it: the embedded workspace may be absent, its columns unparsed.
  return listOf<{ workspace: { slug: string; github_org?: string | null; github_installation_id: unknown } | null }>(data)
    .flatMap((row) => (row.workspace ? [{
      slug: row.workspace.slug,
      github_org: row.workspace.github_org ?? null,
      github_installation_id: row.workspace.github_installation_id === null ? null : numberOf(row.workspace.github_installation_id),
    }] : []))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Adds the person to every workspace, with an installation, whose GitHub org is one of `logins`
 * (idempotent); the slugs of the workspaces they belong to, the one joined first first. `db` is the
 * service role's client: only it may run join_workspaces_by_github(). */
export async function joinByGithub(db: Pick<SupabaseClient<Database>, 'rpc'>, userId: string, logins: string[]): Promise<string[]> {
  const { data, error } = await db.rpc('join_workspaces_by_github', { p_user_id: userId, p_logins: logins });
  if (error) throw new Error(`Supabase: could not join your workspaces (${error.message})`);
  return listOf(data);
}

/** Each client's member workspace reads, by person: a request's client is shared by the viewer, the
 * layout and the page's loaders (src/data/viewer.ts, PRD 657), so they share one read. */
const readsByClient = new WeakMap<object, Map<string, Promise<Workspace | null>>>();

/** The workspace the person plays in, or null. Joining happens at sign-in only, where GitHub's token
 * is at hand (src/data/sign-in.ts): one who belongs to none signs in again, or signs up. Read once
 * per client and person; a failed read is not kept. */
export function memberWorkspace(db: SupabaseClient<Database>, userId: string): Promise<Workspace | null> {
  let reads = readsByClient.get(db);
  if (!reads) readsByClient.set(db, (reads = new Map<string, Promise<Workspace | null>>()));
  const kept = reads.get(userId);
  if (kept) return kept;
  const read = firstWorkspace(db, userId);
  reads.set(userId, read);
  read.catch(() => reads.delete(userId));
  return read;
}

/** Where a sign-in lands: the arcade for a member of a workspace, sign-up for anyone in none (PRD
 * 359), so a newcomer goes straight on to installing Omni Loop. A failed read lands on the arcade,
 * which says so itself. */
export async function landingAfterSignIn(db: SupabaseClient<Database>, userId: string): Promise<'/play' | '/signup'> {
  try {
    return (await firstWorkspace(db, userId)) ? '/play' : '/signup';
  } catch (err) {
    console.error(`auth callback: ${err instanceof Error ? err.message : String(err)}`);
    return '/play';
  }
}

/** Whose arcade it is: the workspace's name and colours. */
export const brandOf = ({ name, theme }: Workspace): Brand => ({ name, theme });
