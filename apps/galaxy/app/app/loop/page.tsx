import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../src/data/member-session';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { demoLoopPage } from '../../../src/loop/page/demo';
import { loadLoopPage, supabaseLoopPageReads } from '../../../src/loop/page/load';
import { LoopScreen } from '../../../src/loop/page/LoopScreen';
import type { LoopPageView } from '../../../src/loop/page/model';

// /app/loop (PRD 1139 s5): every loop of the workspace, who runs it, its repository, its state and its
// last tick. Rendered per request, as the signed-in person, as /app/engineering is, so row-level
// security decides what each read returns. It decides the situation once: the demo in development (or
// OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed in, the list, or
// the notice for an account in no workspace.

export const metadata: Metadata = {
  title: 'Loop · OMNI LOOP',
  description: 'Every loop of the workspace: who runs it, on which repository, its state and its last tick.',
  robots: { index: false, follow: false },
};

async function viewOf(now: Date): Promise<LoopPageView> {
  const session = await memberSession();
  if (session.kind === 'demo') return demoLoopPage(now) ?? { kind: 'unreadable' };
  if (session.kind !== 'signed-in') return session;
  const view = await loadLoopPage(supabaseLoopPageReads(session.db, session.user), null, now);
  return view.kind === 'not-found' ? { kind: 'unreadable' } : view;
}

export default async function LoopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <LoopScreen view={await viewOf(new Date())} supabase={supabaseEnv()} signinError={one(query.signin_error)} />;
}
