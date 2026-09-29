import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { firstParam as one, memberSession } from '../../../../../src/data/member-session';
import { supabaseEnv } from '../../../../../src/data/supabase-server';
import { periodOf, type Period } from '../../../../../src/dashboard/board/period';
import { demoEngineeringBoard } from '../../../../../src/engineering/demo';
import { loadEngineeringRepositoryBoard } from '../../../../../src/engineering/load';
import { EngineeringScreen, type EngineeringView } from '../../../../../src/engineering/EngineeringScreen';
import { sortOf, type SortKey } from '../../../../../src/engineering/tally';

// /app/engineering/<owner>/<repo> (PRD 645 s2): one tracked repository's Engineering board, the same
// board counted over that repository alone, with no Repositories table. Rendered per request, as the
// signed-in person, as /app/engineering is, and it decides the same situations once: the demo, closed,
// the sign-in card, the no-workspace notice, the board. A repository the workspace does not track
// (matched whatever its case) is not found. The period is the query's, 7 days otherwise.

export const metadata: Metadata = {
  title: 'Engineering · OMNI LOOP',
  description: 'One tracked repository’s pull requests: opened, merged, open now, time to merge, who opens, merges and reviews the most, and Omni Loop’s share.',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function viewOf(repo: string, period: Period, sort: SortKey, now: Date): Promise<EngineeringView> {
  const session = await memberSession();
  if (session.kind !== 'demo' && session.kind !== 'signed-in') return session;
  const view = session.kind === 'demo'
    ? demoEngineeringBoard(period, sort, now, repo)
    : await loadEngineeringRepositoryBoard(session.db, session.user, repo, { period, sort, now });
  if (view.kind === 'not-tracked') notFound();
  return view;
}

/** A path part as written; one that is not valid escaping names no repository. */
function decoded(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    notFound();
  }
}

export default async function EngineeringRepositoryPage({ params, searchParams }: Props) {
  const [{ owner, repo }, query] = await Promise.all([params, searchParams]);
  const period = periodOf(one(query.period));
  return (
    <EngineeringScreen
      view={await viewOf(`${decoded(owner)}/${decoded(repo)}`, period, sortOf(one(query.sort)), new Date())}
      period={period}
      supabase={supabaseEnv()}
      signinError={one(query.signin_error)}
      query={query}
    />
  );
}
