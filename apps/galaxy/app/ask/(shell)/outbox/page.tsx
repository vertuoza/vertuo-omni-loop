import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../../../../src/product-filter/product-filter.css';
import '../../../../src/product-home/product-home.css';
import { AskNotOpen, AskUnreachable } from '../../../../src/ask/page/Notice';
import { Outbox } from '../../../../src/ask/page/Outbox';
import { QuestionsTabs } from '../../../../src/ask/page/QuestionsTabs';
import { SignInCard } from '../../../../src/ask/page/SignInCard';
import { readOutboxLive } from '../../../../src/outbox-items/outbox-questions-live';
import { OUTBOX_CALLBACK } from '../../../../src/outbox-items/outbox-questions';

// /ask/outbox (PRD 2011 s14): every open outbox item of the signed-in person's workspaces, across every
// product, the ones that wait on them first, narrowed by `?product=`, each answered in place as on the
// product's Questions tab. Rendered per request; signed out, a sign-in card that comes back here. Either
// way the page starts with the Questions tabs.

export const metadata: Metadata = { title: 'Outbox · Ask · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function OutboxPage({ searchParams }: Props) {
  const { open, body } = await outboxBody(await searchParams);
  return (
    <>
      <QuestionsTabs current="/ask/outbox" {...(open === null ? {} : { open })} />
      {body}
    </>
  );
}

/** What the page shows below its tabs, and how many items are open when it could read them. */
async function outboxBody(query: Awaited<Props['searchParams']>): Promise<{ open: number | null; body: ReactNode }> {
  let read;
  try {
    read = await readOutboxLive(query);
  } catch (error) {
    console.error(error);
    return { open: null, body: <AskUnreachable /> };
  }
  if (read.kind === 'signed-out') {
    return { open: null, body: <SignInCard supabase={read.supabase} returnPath={OUTBOX_CALLBACK} error={one(query.signin_error)} /> };
  }
  if (read.kind === 'unavailable') return { open: null, body: <AskNotOpen /> };
  return { open: read.view.open, body: <Outbox view={read.view} /> };
}
