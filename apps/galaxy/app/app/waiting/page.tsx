import { redirect } from 'next/navigation';
import { redirectTarget, type Query } from '../../../src/inbox/redirects';

// /app/waiting (PRD omni-loop-22, s6): the Waiting board is the Inbox's Workspace tab, its `?tab=` and
// the rest of its query kept (src/inbox/redirects.ts).

export default async function WaitingPage({ searchParams }: { searchParams: Promise<Query> }): Promise<never> {
  redirect(redirectTarget('/app/waiting', await searchParams));
}
