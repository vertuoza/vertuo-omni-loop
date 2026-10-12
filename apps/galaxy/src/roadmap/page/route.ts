// The Roadmaps pages' one decision (PRD 1162), shared by /roadmaps and /roadmaps/<id>: who the page is
// drawn for, decided once (src/data/member-session.ts). In development (or OMNI_LOOP_DEMO=1) the demo;
// with no database, closed; signed out, the demo under a sign-in card; signed in, the workspace's
// roadmaps as that person, so row-level security decides. A roadmap the demo or the workspace does not
// hold is not found, which the page answers. Only a member signed in is offered Mark as done (PRD 1218,
// s7), and only where it is open: the outbox send's client and a database (../../outbox/open.ts).
import { memberSession } from '../../data/member-session';
import { sendOpen } from '../../outbox/open';
import { demoRoadmapPage } from './demo';
import { loadRoadmapPage, supabaseRoadmapPageReads, type RoadmapPageAsk } from './load';
import type { RoadmapPageView } from './model';

export async function roadmapPageView(ask: RoadmapPageAsk, now: Date): Promise<RoadmapPageView | { kind: 'not-found' }> {
  const session = await memberSession();
  if (session.kind === 'closed') return session;
  if (session.kind === 'signed-in') return loadRoadmapPage(supabaseRoadmapPageReads(session.db, session.user), { ...ask, tickable: sendOpen() }, now);
  return demoRoadmapPage(now, ask, session.kind === 'demo' ? 'development' : 'signed-out') ?? { kind: 'not-found' };
}
