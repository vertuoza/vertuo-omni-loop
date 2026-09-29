import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { SwitchAccount } from '../ask/page/SignInCard';
import { DashboardSignIn } from './DashboardSignIn';
import { APP_CALLBACK } from './sign-in';

// The three situations every member-only board page shares before its board (PRD 612): closed (the
// page's own notice), signed out (the sign-in card, or closed without a database), and signed in to an
// account in no workspace (the notice with a way to switch account).

type Supabase = { url: string; key: string };

export interface MemberGateProps {
  kind: 'closed' | 'sign-in' | 'no-workspace';
  /** The page's closed notice. */
  closed: ReactNode;
  /** What the page is, as the no-workspace notice names it: `The Engineering board`. */
  board: string;
  supabase: Supabase | null;
  signinError: string | null;
}

export function MemberGate({ kind, closed, board, supabase, signinError }: MemberGateProps) {
  if (kind === 'closed') return closed;
  if (kind === 'sign-in') return supabase ? <DashboardSignIn supabase={supabase} returnPath={APP_CALLBACK} error={signinError} /> : closed;
  return (
    <Notice title="Your account is not in a workspace">
      <p className="ask-muted">{`${board} is for the members of a workspace. Sign in with your GitHub account to see yours.`}</p>
      {supabase && <SwitchAccount supabase={supabase} />}
    </Notice>
  );
}
