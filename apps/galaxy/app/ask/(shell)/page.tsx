import { redirect } from 'next/navigation';
import { redirectTarget, type Query } from '../../../src/inbox/redirects';

// /ask (PRD omni-loop-22, s6): the page the link `omni ask on` prints. It lands on the Inbox, whose first
// question is open, its query kept (src/inbox/redirects.ts). `/ask/<session>` and `/ask/q/<round>` stay.

export default async function AskHome({ searchParams }: { searchParams: Promise<Query> }): Promise<never> {
  redirect(redirectTarget('/ask', await searchParams));
}
