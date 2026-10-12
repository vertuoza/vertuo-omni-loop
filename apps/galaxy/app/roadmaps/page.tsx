import type { Metadata } from 'next';
import { firstParam as one } from '../../src/data/member-session';
import { supabaseEnv } from '../../src/data/supabase-server';
import { productOf } from '../../src/roadmap/page/load';
import { roadmapPageView } from '../../src/roadmap/page/route';
import { RoadmapsScreen } from '../../src/roadmap/page/RoadmapsScreen';

// /roadmaps (PRD 1162): every roadmap of the workspace, filterable by product (`?product=<id>`), each
// with its milestone, its progress and what blocks it now. Rendered per request, as the signed-in
// person, as /app/loop is; signed out, the demo under a sign-in card (src/roadmap/page/route.ts).

export const metadata: Metadata = {
  title: 'Roadmaps · OMNI LOOP',
  description: 'Every roadmap of the workspace: its milestone, its progress and what blocks it now.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RoadmapsPage({ searchParams }: Props) {
  const query = await searchParams;
  const view = await roadmapPageView({ id: null, product: productOf(one(query.product)) }, new Date());
  return <RoadmapsScreen view={view.kind === 'not-found' ? { kind: 'unreadable' } : view} supabase={supabaseEnv()} signinError={one(query.signin_error)} />;
}
