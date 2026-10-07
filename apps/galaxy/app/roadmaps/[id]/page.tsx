import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { firstParam as one } from '../../../src/data/member-session';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { roadmapIdOf } from '../../../src/roadmap/page/load';
import { roadmapPageView } from '../../../src/roadmap/page/route';
import { RoadmapsScreen } from '../../../src/roadmap/page/RoadmapsScreen';

// /roadmaps/<id> (PRD 1162): one roadmap opened, its milestone, its Gantt, its open questions with an
// answer box for a `person` one, and each PRD linking to its page. Rendered per request, as /roadmaps
// is, and it decides the same situations once. A path that names no roadmap, or a roadmap of another
// workspace, is not found.

export const metadata: Metadata = {
  title: 'Roadmap · OMNI LOOP',
  description: 'One roadmap: its milestone, its Gantt, its open questions and its PRDs.',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RoadmapPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const roadmapId = roadmapIdOf(id);
  if (!roadmapId) notFound();
  const view = await roadmapPageView({ id: roadmapId, product: null }, new Date());
  if (view.kind === 'not-found') notFound();
  return <RoadmapsScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} />;
}
