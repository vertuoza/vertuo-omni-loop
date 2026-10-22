import 'server-only';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { MemberSession } from '../data/member-session';
import { memberWorkspace } from '../data/workspace';
import { loadPeople } from '../people/load';
import { firstOf, tabOf } from './board';
import { demoWaitingBoard } from './demo';
import { loadWaitingBoard, waitingBoardReads, type WaitingBoardData } from './waiting-board.service';

// /app/waiting's controller (PRD 2377 s3; ADR-0095): who reads the page decides what it draws, checked
// first. The demo in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in
// card, and no service runs; an account in no workspace says so. Signed in, the service reads as that
// person, on their own client, so row-level security has the last word; a failed read is the unreadable
// notice, logged.

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;
type Query = Readonly<Record<string, string | string[] | undefined>>;

/** What the page is drawn from. */
export type WaitingView =
  | { kind: 'closed' } | { kind: 'sign-in' } | { kind: 'no-workspace' } | { kind: 'unreadable' }
  | ({ kind: 'board' } & WaitingBoardData);

/** What the controller needs beside the session. */
export interface WaitingDeps {
  workspace(session: SignedIn): Promise<{ id: string } | null>;
  load(session: SignedIn, workspace: string, query: Query, now: Date): Promise<WaitingBoardData>;
}

/** The live reads: the workspace the person joined first, as /app's, and the board on their client. */
const LIVE_WAITING: WaitingDeps = {
  workspace: (session) => memberWorkspace(session.db, session.user.id),
  async load(session, workspace, query, now) {
    const { reads, filterReads } = waitingBoardReads(session.db);
    return loadWaitingBoard(reads, filterReads, { workspace, viewerId: session.user.id, people: await loadPeople(session.db, workspace), query, now });
  },
};

export async function waitingViewOf(session: MemberSession, query: Query, now: Date, deps: WaitingDeps = LIVE_WAITING): Promise<WaitingView> {
  if (session.kind === 'demo') return { kind: 'board', ...demoWaitingBoard(now, tabOf(firstOf(query.tab))) };
  if (session.kind !== 'signed-in') return session;
  try {
    const workspace = await deps.workspace(session);
    if (!workspace) return { kind: 'no-workspace' };
    return { kind: 'board', ...(await deps.load(session, workspace.id, query, now)) };
  } catch (err) {
    console.error(`waiting: the board could not be read (${messageOf(err)})`);
    return { kind: 'unreadable' };
  }
}
