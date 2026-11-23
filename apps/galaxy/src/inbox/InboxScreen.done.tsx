import { AskNotOpen, AskUnreachable } from '../ask/page/Notice';
import { SignInCard } from '../ask/page/SignInCard';
import { HISTORY_CALLBACK } from '../ask/page/sign-in';
import { WorkspaceHistory } from '../ask/page/WorkspaceHistory';
import type { DoneView } from './inbox.controller';

// The Inbox's Done tab (PRD omni-loop-22, s5): today's Questions history, newest first, with its filters
// and search (src/ask/page/WorkspaceHistory.tsx), or why it could not be read.

const UNREAD = { unavailable: AskNotOpen, unreachable: AskUnreachable } as const;

export function InboxDone({ view, signinError }: { view: DoneView; signinError: string | null }) {
  if (view.kind === 'history') {
    return (
      <WorkspaceHistory
        items={view.items} choices={view.choices} filters={view.filters} categories={view.categories}
        all={view.all} matched={view.matched ?? view.all} next={view.next ?? null} now={view.now}
      />
    );
  }
  if (view.kind === 'signed-out') return <SignInCard supabase={view.supabase} returnPath={HISTORY_CALLBACK} error={signinError} />;
  const Unread = UNREAD[view.kind];
  return <Unread />;
}
