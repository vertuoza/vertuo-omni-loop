import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../src/data/member-session';
import { inboxViewOf } from '../../../src/inbox/inbox.controller';
import { InboxScreen } from '../../../src/inbox/InboxScreen';
import { filterOf } from '../../../src/inbox/InboxScreen.model';
import { InboxOpen } from '../../../src/inbox/InboxScreen.open';

// /app/inbox (PRD omni-loop-22, s5), the Inbox's Open tab: everything that waits on the person, the
// first question open, ready to answer. Rendered per request for the sign-in; the list is the app
// shell's waiting list, read by its provider, so the page adds no read. `?kind=` (question, approval,
// outbox, review) and `?from=shared` pick a chip.

export const metadata: Metadata = {
  title: 'Inbox · OMNI LOOP',
  description: 'Everything that waits on you, the oldest question first, ready to answer.',
  robots: { index: false, follow: false },
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const view = inboxViewOf(await memberSession());
  return (
    <InboxScreen view={view} tab="open" signinError={one(query.signin_error)}>
      {view.kind === 'answering' && <InboxOpen source={view.source} me={view.me} filter={filterOf(query)} />}
    </InboxScreen>
  );
}
