import 'server-only';
import { serverEnv } from '../../env';
import { DEMO_MEMBERS, demoHistory } from './demo';
import type { Member } from './question';
import { readAsSignedIn, sessionsMembers, type NotRead } from './signed-in-live';
import { readHistory, type HistoryPage } from './source';
import { historyFacetsOf, historyPageOf, type HistoryFilters } from './workspace-history';

// The workspace's history, read on the server as the signed-in person (PRD 144): one page of every
// workspace they belong to under the filters, its counts (PRD omni-loop-23, ADR-0171), and those
// workspaces' members, to name who asked and who answered. The demo pages and counts its own made-up
// workspace the same way, in memory.

export type HistoryRead = ({ kind: 'page'; members: Member[] } & HistoryPage) | NotRead;

export async function readHistoryLive(filters: HistoryFilters, now: number): Promise<HistoryRead> {
  const mode = serverEnv().mode;
  if (mode === 'demo') {
    const rows = demoHistory(now);
    return { kind: 'page', ...historyPageOf(rows, filters), facets: historyFacetsOf(rows, filters), members: DEMO_MEMBERS };
  }
  return readAsSignedIn(mode, async (db): Promise<HistoryRead> => {
    const page = await readHistory(db, filters);
    const all = await sessionsMembers(db, page.rows);
    const members = [...new Map(all.map((m) => [m.user_id, m])).values()];
    return { kind: 'page', ...page, members };
  });
}
