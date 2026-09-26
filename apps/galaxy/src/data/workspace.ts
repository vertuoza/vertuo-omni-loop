// The workspace a signed-in person plays in (supabase/migrations/20260926120000_workspaces.sql), read
// as that person: row-level security hands them their own memberships and the workspaces they belong
// to, nothing else. Crew is membership, never an email domain: join_by_domain() makes a confirmed
// account of a workspace's join_domain a member. A person may belong to several workspaces; until
// switching comes (PRD 2), the arcade plays the one they joined first, by joined_at, then slug.
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

/** Adds the caller to every workspace of their confirmed email's domain (idempotent); the slugs of
 * the workspaces they belong to, the one joined first first. */
export async function joinByDomain(db: Pick<SupabaseClient, 'rpc'>): Promise<string[]> {
  const { data, error } = await db.rpc('join_by_domain');
  if (error) throw new Error(`Supabase: could not join your workspace (${error.message})`);
  return (data ?? []) as string[];
}

/** The workspace the person plays in. One who belongs to none yet (a session from before
 * workspaces, or a sign-in whose join failed) is joined by domain, once, then read again. */
export async function memberWorkspace(db: SupabaseClient, userId: string): Promise<Workspace | null> {
  const first = await firstWorkspace(db, userId);
  if (first) return first;
  const joined = await joinByDomain(db);
  return joined.length ? firstWorkspace(db, userId) : null;
}

/** Whose arcade it is: the workspace's name and colours. */
export const brandOf = ({ name, theme }: Workspace): Brand => ({ name, theme });
