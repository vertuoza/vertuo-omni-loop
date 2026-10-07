import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { firstParam as one, memberSession } from '../../../../src/data/member-session';
import { supabaseEnv } from '../../../../src/data/supabase-server';
import { demoLoopPage } from '../../../../src/loop/page/demo';
import { loadLoopPage, loopIdOf, supabaseLoopPageReads } from '../../../../src/loop/page/load';
import { LoopScreen } from '../../../../src/loop/page/LoopScreen';
import type { LoopPageView } from '../../../../src/loop/page/model';

// /app/loop/<id> (PRD 1139 s5): one loop opened, its plan as a timeline per PRD with every version,
// its ledger and its parked PRDs. Rendered per request, as the signed-in person, as /app/loop is, and
// it decides the same situations once. A path that names no loop, or a loop of another workspace, is
// not found.

export const metadata: Metadata = {
  title: 'Loop · OMNI LOOP',
  description: 'One loop: its plan per PRD with every version, its ledger tick by tick, and the PRDs it parked on people.',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function viewOf(id: string, now: Date): Promise<LoopPageView> {
  const session = await memberSession();
  if (session.kind !== 'demo' && session.kind !== 'signed-in') return session;
  const view = session.kind === 'demo' ? demoLoopPage(now, id) : await loadLoopPage(supabaseLoopPageReads(session.db, session.user), id, now);
  if (!view || view.kind === 'not-found') notFound();
  return view;
}

export default async function LoopDetailPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const loopId = loopIdOf(id);
  if (!loopId) notFound();
  return <LoopScreen view={await viewOf(loopId, new Date())} supabase={supabaseEnv()} signinError={one(query.signin_error)} />;
}
