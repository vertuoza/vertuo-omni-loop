import type { Metadata } from 'next';
import { ForMe } from '../../../src/ask/page/ForMe';
import { readForMeLive } from '../../../src/ask/page/for-me-live';
import { Notice } from '../../../src/ask/page/Notice';
import { QuestionsTabs } from '../../../src/ask/page/QuestionsTabs';
import { SignInCard } from '../../../src/ask/page/SignInCard';
import { FOR_ME_CALLBACK } from '../../../src/ask/page/sign-in';

// /ask/for-me (PRD 144): the open questions a teammate shared with the signed-in person, with their
// time left, each opening /ask/q/<round>. Rendered per request; signed out, a sign-in card that comes
// back here. Either way the page starts with the Questions tabs (PRD 733).

export const metadata: Metadata = { title: 'Shared with me · Ask · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function ForMePage({ searchParams }: Props) {
  return (
    <>
      <QuestionsTabs current="/ask/for-me" />
      {await forMeBody(await searchParams)}
    </>
  );
}

async function forMeBody(query: Awaited<Props['searchParams']>) {
  let read;
  try {
    read = await readForMeLive(Date.now());
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The ask database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (read.kind === 'signed-out') return <SignInCard supabase={read.supabase} returnPath={FOR_ME_CALLBACK} error={one(query.signin_error)} />;
  if (read.kind === 'unavailable') {
    return (
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot show Claude&apos;s questions.</p>
      </Notice>
    );
  }
  return <ForMe entries={read.entries} />;
}
