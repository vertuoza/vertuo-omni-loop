import 'server-only';
import { arcadeMode } from '../../data/mode';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { DEMO_MEMBERS, demoHistory } from './demo';
import type { Member } from './question';
import { readHistory, readMembers } from './source';
import type { HistoryRow } from './workspace-history';

// The workspace's history, read on the server as the signed-in person (PRD 144): the newest rounds of
// every workspace they belong to, and those workspaces' members, to name who asked and who answered.
// The demo shows its own made-up workspace.

export type HistoryRead =
  | { kind: 'rows'; rows: HistoryRow[]; members: Member[] }
  | { kind: 'signed-out'; supabase: { url: string; key: string } }
  | { kind: 'unavailable' };

export async function readHistoryLive(now: number): Promise<HistoryRead> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') return { kind: 'rows', rows: demoHistory(now), members: DEMO_MEMBERS };
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return { kind: 'unavailable' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { kind: 'signed-out', supabase: env };
  const rows = await readHistory(db);
  const places = [...new Set(rows.map((r) => r.session.workspace_id).filter((w): w is string => Boolean(w)))];
  const all = (await Promise.all(places.map((w) => readMembers(db, w)))).flat();
  const members = [...new Map(all.map((m) => [m.user_id, m])).values()];
  return { kind: 'rows', rows, members };
}
