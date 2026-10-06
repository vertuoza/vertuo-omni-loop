import 'server-only';
import type { ArcadeMode } from '../../data/mode';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import type { Member } from './question';
import { readMembers } from './source';

// What the ask pages read as the signed-in person (PRD 144) share: no database, or a closed arcade,
// reads as unavailable; nobody signed in, as signed out with what the sign-in button needs.

type ServerDb = Awaited<ReturnType<typeof supabaseServer>>;

export type NotRead =
  | { kind: 'signed-out'; supabase: { url: string; key: string } }
  | { kind: 'unavailable' };

/** `read` as the signed-in person, or why it could not run. */
export async function readAsSignedIn<T>(mode: ArcadeMode, read: (db: ServerDb, userId: string) => Promise<T>): Promise<T | NotRead> {
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return { kind: 'unavailable' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { kind: 'signed-out', supabase: env };
  return read(db, user.id);
}

/** The members of every workspace the rows' sessions belong to, workspace after workspace. */
export async function sessionsMembers(db: ServerDb, rows: readonly { session: { workspace_id?: string | null } }[]): Promise<Member[]> {
  const places = [...new Set(rows.map((r) => r.session.workspace_id).filter((w): w is string => Boolean(w)))];
  return (await Promise.all(places.map((w) => readMembers(db, w)))).flat();
}
