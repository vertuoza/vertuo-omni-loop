import 'server-only';
import { arcadeMode } from '../../data/mode';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { DEMO_MEMBERS } from './demo';
import { forMeList, type ForMeEntry } from './question';
import { readForMe, readMembers } from './source';

// For me, read on the server as the signed-in person (PRD 144): the open rounds shared with them. Null
// when there is nobody signed in, or no database; the demo shows one question shared by a teammate.

export type ForMeRead =
  | { kind: 'entries'; entries: ForMeEntry[] }
  | { kind: 'signed-out'; supabase: { url: string; key: string } }
  | { kind: 'unavailable' };

export async function readForMeLive(now: number): Promise<ForMeRead> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') {
    const teammate = DEMO_MEMBERS[1]!;
    return {
      kind: 'entries',
      entries: [{ roundId: 'demo', question: 'How should the page and the agent be authenticated?', sessionTitle: 'vertuo-omni-loop · feat/ask-mode', sharedBy: teammate.name ?? teammate.email, minutesLeft: 7 }],
    };
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return { kind: 'unavailable' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { kind: 'signed-out', supabase: env };
  const rows = await readForMe(db, user.id);
  const places = [...new Set(rows.map((r) => r.session.workspace_id).filter((w): w is string => Boolean(w)))];
  const members = (await Promise.all(places.map((w) => readMembers(db, w)))).flat();
  return { kind: 'entries', entries: forMeList(rows, members, now) };
}

/** How many questions wait under For me, for the header; null when it cannot say (signed out, no
 * database, the database failing): the header then shows no count. */
export async function forMeCount(now: number): Promise<number | null> {
  try {
    const read = await readForMeLive(now);
    return read.kind === 'entries' ? read.entries.length : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
