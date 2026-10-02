import 'server-only';
import { arcadeMode } from '../../data/mode';
import { DEMO_MEMBERS, demoHistory } from './demo';
import type { Member } from './question';
import { readAsSignedIn, sessionsMembers, type NotRead } from './signed-in-live';
import { readHistory } from './source';
import type { HistoryRow } from './workspace-history';

// The workspace's history, read on the server as the signed-in person (PRD 144): the newest rounds of
// every workspace they belong to, and those workspaces' members, to name who asked and who answered.
// The demo shows its own made-up workspace.

export type HistoryRead = { kind: 'rows'; rows: HistoryRow[]; members: Member[] } | NotRead;

export async function readHistoryLive(now: number): Promise<HistoryRead> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') return { kind: 'rows', rows: demoHistory(now), members: DEMO_MEMBERS };
  return readAsSignedIn(mode, async (db): Promise<HistoryRead> => {
    const rows = await readHistory(db);
    const all = await sessionsMembers(db, rows);
    const members = [...new Map(all.map((m) => [m.user_id, m])).values()];
    return { kind: 'rows', rows, members };
  });
}
