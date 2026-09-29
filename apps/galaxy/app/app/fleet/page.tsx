import type { Metadata } from 'next';
import { supabaseEnv } from '../../../src/data/supabase-server';
import { viewer } from '../../../src/data/viewer';
import { periodOf, type Period } from '../../../src/dashboard/board/period';
import { demoFleetBoard, loadFleetBoard } from '../../../src/dashboard/fleet/fleet';
import { FleetScreen, type FleetView } from '../../../src/dashboard/fleet/FleetScreen';

// /app/fleet (PRD 572): the board of one fleet, the viewer's by default, any fleet by `?fleet=<name>`,
// under a picker of every fleet that keeps the period. Rendered per request, as the signed-in person,
// as /app/workspace is. The period is the query's (`?period=7d|30d|season`, 7 days otherwise). It
// decides the situation once: the demo world in development (or OMNI_LOOP_DEMO=1); with no database,
// closed; signed out, the sign-in card; signed in, the fleet's board, the picker, the no-fleet line,
// or the notice for an account in no workspace.

export const metadata: Metadata = {
  title: 'Fleet · OMNI LOOP',
  description: 'A fleet’s board: its members, the PRs merged and PRDs moved per day, and its place this season.',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** A query value, or null when absent or empty. */
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || null;

async function viewOf(asked: string | null, period: Period, now: Date): Promise<FleetView> {
  const seen = await viewer();
  if (seen.kind === 'demo') return demoFleetBoard(asked, period, now);
  if (seen.kind !== 'signed-in') return { kind: seen.kind };
  return loadFleetBoard(seen.db, seen.user, asked, period, now);
}

export default async function FleetPage({ searchParams }: Props) {
  const query = await searchParams;
  const period = periodOf(one(query.period));
  return (
    <FleetScreen
      view={await viewOf(one(query.fleet), period, new Date())}
      supabase={supabaseEnv()}
      signinError={one(query.signin_error)}
      query={query}
    />
  );
}
