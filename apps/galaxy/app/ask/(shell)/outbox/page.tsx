import { redirect } from 'next/navigation';
import { redirectTarget, type Query } from '../../../../src/inbox/redirects';

// /ask/outbox (PRD omni-loop-22, s6): the outbox items are the Inbox's Outbox chip, its query kept
// (src/inbox/redirects.ts). The sign-in callback beside it still comes back here.

export default async function OutboxPage({ searchParams }: { searchParams: Promise<Query> }): Promise<never> {
  redirect(redirectTarget('/ask/outbox', await searchParams));
}
