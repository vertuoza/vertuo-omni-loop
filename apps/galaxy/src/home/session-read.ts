import { createBrowserClient } from '@supabase/ssr';
import { lookOf } from '@omni/galaxy';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import { signedIn, type PlayerFace, type SessionUser, type SignedInView } from './signed-in';

// The visitor's session, read in the browser once HOME is there (PRD 1006), as the Fleets and Ask
// pages read it: the page itself stays static and reaches no database. The reads sit behind a small
// port, so their order is tested on fixtures. It never throws: no session, a failed read or no
// Supabase (the demo) is nobody signed in, and the page stays today's.
// s3: the hero comes first, as the app bar draws it (viewerLive, src/nav/viewer.ts). The photo or the
// initial is drawn at once, from the session alone; then the workspace is read, then the player row
// and the workspace's fleets together, and a player with a hero gets it, in their fleet's colour. Any
// of those reads failing, or no player row, or an empty hero, leaves the photo where it is.

/** Where the session is read from; each read is allowed to throw. */
export interface SessionPort {
  user(): Promise<SessionUser | null>;
  /** The workspace they joined first, or null when they belong to none. */
  workspace(userId: string): Promise<{ id: string } | null>;
  /** Their player row in that workspace: its stored hero, unchecked, and their fleet. */
  player(userId: string, workspaceId: string): Promise<{ hero: unknown; team: string | null } | null>;
  /** The workspace's fleets, with their stored colours. */
  fleets(workspaceId: string): Promise<{ name: string; color: string | null }[]>;
}

/** Their player row's hero and their fleet's colour (lookOf's default when it stores none), or null. */
async function playerFace(port: SessionPort, userId: string): Promise<PlayerFace | null> {
  const workspace = await port.workspace(userId);
  if (!workspace) return null;
  const [player, fleets] = await Promise.all([port.player(userId, workspace.id), port.fleets(workspace.id)]);
  if (!player) return null;
  const fleet = fleets.find((f) => f.name === player.team);
  return { hero: player.hero, color: fleet ? (fleet.color ?? lookOf(fleet.name).color) : null };
}

/**
 * The pill for whoever is signed in, or null, as the session alone decides it. `port` is null on the
 * demo, which has no Supabase. `draw`, when given, receives that same answer at once, then, for a
 * player with a hero, the pill with their hero once it is read.
 */
export async function readSignedIn(port: SessionPort | null, draw?: (view: SignedInView | null) => void): Promise<SignedInView | null> {
  let user: SessionUser | null = null;
  try {
    user = port && await port.user();
  } catch {
    user = null;
  }
  const first = signedIn(user);
  draw?.(first);
  const id = user?.id;
  if (port && first && id && draw) {
    void playerFace(port, id).then((player) => {
      const hero = signedIn(user, player);
      if (hero?.face.kind === 'hero') draw(hero);
    }, () => {});
  }
  return first;
}

/** The galaxy's Supabase, as the browser reads it. Created on first read, never on the server. */
export function browserSessionPort(supabase: { url: string; key: string }): SessionPort {
  let client: ReturnType<typeof createBrowserClient<Database>> | null = null;
  const db = () => (client ??= createBrowserClient<Database>(supabase.url, supabase.key));
  return {
    async user() {
      const { data: { user } } = await db().auth.getUser();
      return user;
    },
    workspace: (userId) => memberWorkspace(db(), userId),
    async player(userId, workspaceId) {
      const { data, error } = await db().from('players').select('hero, team').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`Supabase: could not read your player (${error.message})`);
      return data;
    },
    async fleets(workspaceId) {
      const { data, error } = await db().from('teams').select('name, color').eq('workspace_id', workspaceId);
      if (error) throw new Error(`Supabase: could not read the fleets (${error.message})`);
      return data ?? [];
    },
  };
}
