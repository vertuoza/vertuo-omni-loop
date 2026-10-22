import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../src/data/member-session';
import { tabOf } from '../../../src/waiting-board/board';
import { WaitingScreen } from '../../../src/waiting-board/WaitingScreen';
import { waitingViewOf } from '../../../src/waiting-board/waiting-board.controller';

// /app/waiting (PRD 2377 s3): what waits on a person to ship, since when and whose turn it is, for every
// member. Rendered per request, as the signed-in person, so row-level security decides what each read
// returns; the stages sync records the waits, so the page makes no GitHub request. The tab is the
// query's (`?tab=workspace`, Workspace otherwise). The controller decides the situation once: the demo in
// development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card; signed in,
// the board, or the notice for an account in no workspace.

export const metadata: Metadata = {
  title: 'Waiting · OMNI LOOP',
  description: 'Every pull request and PRD that waits on a person to ship, since when, and whose turn it is.',
  robots: { index: false, follow: false },
};

export default async function WaitingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return (
    <WaitingScreen
      view={await waitingViewOf(await memberSession(), query, new Date())}
      tab={tabOf(one(query.tab))}
      signinError={one(query.signin_error)}
    />
  );
}
