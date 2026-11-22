import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../../src/data/member-session';
import { inboxViewOf } from '../../../../src/inbox/inbox.controller';
import { InboxScreen } from '../../../../src/inbox/InboxScreen';
import { tabOf } from '../../../../src/waiting-board/board';
import { WaitingScreen } from '../../../../src/waiting-board/WaitingScreen';
import { waitingViewOf } from '../../../../src/waiting-board/waiting-board.controller';

// /app/inbox/workspace (PRD omni-loop-22, s5), the Inbox's Workspace tab: today's Waiting board
// (/app/waiting, PRD 2377 s3), unchanged, its own tabs kept (`?tab=`): what waits on every member to ship,
// since when and whose turn it is.

export const metadata: Metadata = {
  title: 'Workspace · Inbox · OMNI LOOP',
  description: 'Every pull request and PRD that waits on a person to ship, since when, and whose turn it is.',
  robots: { index: false, follow: false },
};

export default async function InboxWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const session = await memberSession();
  const view = inboxViewOf(session);
  return (
    <InboxScreen view={view} tab="workspace" signinError={one(query.signin_error)}>
      {view.kind === 'answering' && (
        <WaitingScreen view={await waitingViewOf(session, query, new Date())} tab={tabOf(one(query.tab))} signinError={one(query.signin_error)} />
      )}
    </InboxScreen>
  );
}
