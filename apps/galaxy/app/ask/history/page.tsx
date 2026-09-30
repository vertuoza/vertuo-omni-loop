import type { Metadata } from 'next';
import { readHistoryLive } from '../../../src/ask/page/history-live';
import { Notice } from '../../../src/ask/page/Notice';
import { QuestionsTabs } from '../../../src/ask/page/QuestionsTabs';
import { SignInCard } from '../../../src/ask/page/SignInCard';
import { HISTORY_CALLBACK } from '../../../src/ask/page/sign-in';
import { WorkspaceHistory } from '../../../src/ask/page/WorkspaceHistory';
import { historyChoices, historyList, readHistoryFilters } from '../../../src/ask/page/workspace-history';

// /ask/history (PRD 144): every round of the signed-in person's workspaces, newest first, filtered by
// category, repo, PRD, skill, who asked and who answered, and searched by the words of a question or
// its answer; each row opens /ask/q/<round>. Rendered per request; signed out, a sign-in card that
// comes back here. Either way the page starts with the Questions tabs (PRD 733).

export const metadata: Metadata = { title: 'History · Ask · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function HistoryPage({ searchParams }: Props) {
  return (
    <>
      <QuestionsTabs current="/ask/history" />
      {await historyBody(await searchParams)}
    </>
  );
}

async function historyBody(query: Awaited<Props['searchParams']>) {
  let read;
  try {
    read = await readHistoryLive(Date.now());
  } catch (error) {
    console.error(error);
    return (
      <Notice title="The ask database could not answer" tone="error">
        <p className="ask-muted">Reload the page in a moment.</p>
      </Notice>
    );
  }
  if (read.kind === 'signed-out') return <SignInCard supabase={read.supabase} returnPath={HISTORY_CALLBACK} error={one(query.signin_error)} />;
  if (read.kind === 'unavailable') {
    return (
      <Notice title="Ask mode is not open here">
        <p className="ask-muted">This deployment has no database, so it cannot show Claude&apos;s questions.</p>
      </Notice>
    );
  }
  const filters = readHistoryFilters(query);
  return (
    <WorkspaceHistory
      items={historyList(read.rows, filters, read.members)}
      choices={historyChoices(read.rows, read.members)}
      filters={filters}
    />
  );
}
