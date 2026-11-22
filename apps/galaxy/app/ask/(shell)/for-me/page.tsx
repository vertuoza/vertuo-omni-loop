import { redirect } from 'next/navigation';
import { redirectTarget, type Query } from '../../../../src/inbox/redirects';

// /ask/for-me (PRD omni-loop-22, s6): the questions shared with the person are the Inbox's Shared with me
// chip, its query kept (src/inbox/redirects.ts). The sign-in callback beside it still comes back here.

export default async function ForMePage({ searchParams }: { searchParams: Promise<Query> }): Promise<never> {
  redirect(redirectTarget('/ask/for-me', await searchParams));
}
