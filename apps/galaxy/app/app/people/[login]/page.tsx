import type { Metadata } from 'next';
import { supabaseEnv } from '../../../../src/data/supabase-server';
import { viewer } from '../../../../src/data/viewer';
import { periodOf, type Period } from '../../../../src/dashboard/board/period';
import { demoProfile, loadProfileBoard } from '../../../../src/profile/profile';
import { ProfileScreen, type ProfileView } from '../../../../src/profile/ProfileScreen';
import { profileLogin } from '../../../../src/profile/select';
import { BoardLoading } from '../../../../src/skeleton/pages';
import { Streamed } from '../../../../src/skeleton/Streamed';

// /app/people/<login> (PRD 698 s3): one member's profile, read-only, in the viewer's workspace.
// Rendered per request, as the signed-in person, as /app/fleet is, and it decides the same situations
// once: the demo world in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out,
// the sign-in card; signed in, the profile, "not in this workspace", or the notice for an account in
// no workspace. The login is the path's, in lower case; a path that is no GitHub login names nobody,
// and nothing is read for it. The period is the query's (`?period=7d|30d|season`, 7 days otherwise).

export const metadata: Metadata = {
  title: 'Profile · OMNI LOOP',
  description: 'A member’s profile: their season, their board, and their pull requests and reviews.',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ login: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

type Seen = Awaited<ReturnType<typeof viewer>>;

/** A path part as written; one that is not valid escaping is kept as is, and names nobody. */
function decoded(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function viewOf(seen: Exclude<Seen, { kind: 'signed-in' }>, login: string | null, asked: string, period: Period, now: Date): ProfileView {
  if (seen.kind !== 'demo') return { kind: seen.kind };
  return login === null ? { kind: 'not-member', login: asked } : demoProfile(login, period, now);
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const [{ login: part }, query] = await Promise.all([params, searchParams]);
  const period = periodOf(one(query.period));
  const asked = decoded(part);
  const login = profileLogin(asked);
  const now = new Date();
  const screen = (view: ProfileView) => (
    <ProfileScreen view={view} supabase={supabaseEnv()} signinError={one(query.signin_error)} query={query} />
  );
  const seen = await viewer();
  if (seen.kind !== 'signed-in') return screen(viewOf(seen, login, asked, period, now));
  if (login === null) return screen({ kind: 'not-member', login: asked });
  return (
    <Streamed read={loadProfileBoard(seen.db, seen.user, login, period, now)} skeleton={<BoardLoading />}>
      {screen}
    </Streamed>
  );
}
