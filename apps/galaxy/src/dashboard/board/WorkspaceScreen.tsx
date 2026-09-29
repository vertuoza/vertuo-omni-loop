import { Notice } from '../../ask/page/Notice';
import { SwitchAccount } from '../../ask/page/SignInCard';
import { DashboardSignIn } from '../DashboardSignIn';
import { APP_CALLBACK } from '../sign-in';
import { Board } from './Board';
import type { Query } from './links';
import type { BoardValue } from './load';

// /app/workspace in each situation (PRD 572), decided once by the page, as /app decides its own: the
// demo and a member get the workspace's board, headed by the workspace's name, ending with the
// season's fleet ranking; a deployment with no database says the board is not open here; signed out,
// only the sign-in card; signed in to an account in no workspace, the notice with a way to switch.

type Supabase = { url: string; key: string };

export const WORKSPACE_PATH = '/app/workspace';

export type WorkspaceView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'board'; name: string; board: BoardValue };

export interface WorkspaceScreenProps {
  view: WorkspaceView;
  supabase: Supabase | null;
  signinError: string | null;
  query: Query;
}

function Closed() {
  return (
    <Notice title="The workspace board is not open here">
      <p className="ask-muted">This deployment has no database, so it knows nobody’s work.</p>
    </Notice>
  );
}

export function WorkspaceScreen({ view, supabase, signinError, query }: WorkspaceScreenProps) {
  switch (view.kind) {
    case 'closed':
      return <Closed />;
    case 'sign-in':
      return supabase ? <DashboardSignIn supabase={supabase} returnPath={APP_CALLBACK} error={signinError} /> : <Closed />;
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">The workspace board is for the members of a workspace. Sign in with your GitHub account to see yours.</p>
          {supabase && <SwitchAccount supabase={supabase} />}
        </Notice>
      );
    case 'board':
      return (
        <div className="dash">
          <h1 className="dash-name">{view.name}</h1>
          <Board board={view.board} path={WORKSPACE_PATH} query={query} fleets />
        </div>
      );
  }
}
