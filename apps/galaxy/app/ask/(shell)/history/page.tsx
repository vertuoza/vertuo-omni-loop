import { redirect } from 'next/navigation';
import { redirectTarget, type Query } from '../../../../src/inbox/redirects';

// /ask/history (PRD omni-loop-22, s6): the history is the Inbox's Done tab, its query kept
// (src/inbox/redirects.ts). The sign-in callback beside it still comes back here.

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Query> }): Promise<never> {
  redirect(redirectTarget('/ask/history', await searchParams));
}
