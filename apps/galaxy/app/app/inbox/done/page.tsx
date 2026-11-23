import type { Metadata } from 'next';
import { firstParam as one, memberSession } from '../../../../src/data/member-session';
import { doneViewOf, inboxViewOf } from '../../../../src/inbox/inbox.controller';
import { InboxScreen } from '../../../../src/inbox/InboxScreen';
import { InboxDone } from '../../../../src/inbox/InboxScreen.done';

// /app/inbox/done (PRD omni-loop-22, s5), the Inbox's Done tab: today's Questions history (/ask/history,
// PRD 144), newest first, with its filters and search, each row opening /ask/q/<round>. Rendered per
// request, as the signed-in person.

export const metadata: Metadata = {
  title: 'Done · Inbox · OMNI LOOP',
  robots: { index: false, follow: false },
};

export default async function InboxDonePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const view = inboxViewOf(await memberSession());
  return (
    <InboxScreen view={view} tab="done" signinError={one(query.signin_error)}>
      {view.kind === 'answering' && <InboxDone view={await doneViewOf(query, Date.now())} signinError={one(query.signin_error)} />}
    </InboxScreen>
  );
}
