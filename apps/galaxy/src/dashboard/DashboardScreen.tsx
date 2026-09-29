import { Notice } from '../ask/page/Notice';
import { SwitchAccount } from '../ask/page/SignInCard';
import type { Query } from './board/links';
import { Dashboard } from './Dashboard';
import { DashboardSignIn } from './DashboardSignIn';
import type { DashboardData } from './load';
import { APP_CALLBACK } from './sign-in';

// /app in each situation of the spec's States table (PRD 328), decided once by the page, top to
// bottom: the demo and a member get the dashboard (a failed read empties only its own part); a
// deployment with no database says the dashboard is not open here (the sidebar still leads everywhere);
// signed out, only the sign-in card; signed in to an account in no workspace, the notice with a way
// to switch account, as /knowledge does.

type Supabase = { url: string; key: string };

export type DashboardView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'dashboard'; dashboard: DashboardData };

export interface DashboardScreenProps {
  view: DashboardView;
  /** The database's public settings, for the sign-in card and Switch account: null without one. */
  supabase: Supabase | null;
  /** Why the last sign-in was refused (`?signin_error=`), for the sign-in card to say. */
  signinError: string | null;
  /** The page's query: the board's period switch keeps the rest of it. */
  query: Query;
}

function Closed() {
  return (
    <Notice title="The dashboard is not open here">
      <p className="ask-muted">This deployment has no database, so it knows nobody’s hero, fleet or season.</p>
    </Notice>
  );
}

export function DashboardScreen({ view, supabase, signinError, query }: DashboardScreenProps) {
  switch (view.kind) {
    case 'closed':
      return <Closed />;
    case 'sign-in':
      return supabase ? <DashboardSignIn supabase={supabase} returnPath={APP_CALLBACK} error={signinError} /> : <Closed />;
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">
            The dashboard is for the members of a workspace. Sign in with your GitHub account to see yours.
          </p>
          {supabase && <SwitchAccount supabase={supabase} />}
        </Notice>
      );
    case 'dashboard':
      return <Dashboard dashboard={view.dashboard} query={query} />;
  }
}
