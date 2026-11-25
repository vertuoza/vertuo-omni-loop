import { Notice } from '../../ask/page/Notice';
import { MemberGate } from '../../dashboard/MemberGate';
import type { Query, SupervisorPageView } from './model';
import { SupervisorBoard } from './SupervisorBoard';
import './supervisor.css';

// /app/supervisor in each situation (PRD omni-loop-34 s5), decided once by the page, as /app/runners decides its own:
// closed, signed out and in no workspace through the shared gate; a read that failed; then the Supervisor's board,
// ./SupervisorBoard.tsx, drawn as the `supervisor` screen of the library.

export interface SupervisorPageProps {
  view: SupervisorPageView;
  query: Query;
  supabase: { url: string; key: string } | null;
  signinError: string | null;
}

function Closed() {
  return <Notice title="The Supervisor"><p className="ask-muted">The Supervisor is not open on this deployment.</p></Notice>;
}

export function SupervisorPage({ view, query, supabase, signinError }: SupervisorPageProps) {
  if (view.kind === 'closed' || view.kind === 'sign-in' || view.kind === 'no-workspace') {
    return <MemberGate kind={view.kind} closed={<Closed />} board="The Supervisor page" supabase={supabase} signinError={signinError} />;
  }
  if (view.kind === 'unreadable') {
    return <Notice title="The Supervisor"><p className="ask-muted">The Supervisor&rsquo;s findings could not be read. Try again in a moment.</p></Notice>;
  }
  return <SupervisorBoard data={view} query={query} />;
}
