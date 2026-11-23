import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { supabaseEnv } from '../data/supabase-server';
import type { InboxView } from './inbox.controller';
import { InboxHead, type InboxTab } from './InboxScreen.header';
import { InboxSignIn } from './InboxScreen.signin';
import './inbox.css';

// The Inbox (PRD omni-loop-22, s5), at /app/inbox (Open), /app/inbox/done (Done) and /app/inbox/workspace
// (Workspace), inside the app shell: one place for everything that waits on the person. Each tab is
// headed the same (src/inbox/InboxScreen.header.tsx); the page hands the tab's body: the Open tab's list
// and panel (src/inbox/InboxScreen.open.tsx), today's Questions history, or today's Waiting board,
// unchanged. A deployment with no database says the Inbox is not open here; signed out, only the
// sign-in card.

function Closed() {
  return (
    <Notice title="The Inbox is not open here">
      <p className="ask-muted">This deployment has no database, so nothing waits on anyone here.</p>
    </Notice>
  );
}

export function InboxScreen({ view, tab, signinError, children }: { view: InboxView; tab: InboxTab; signinError: string | null; children?: ReactNode }) {
  if (view.kind === 'closed') return <Closed />;
  if (view.kind === 'sign-in') {
    const supabase = supabaseEnv();
    return supabase ? <InboxSignIn supabase={supabase} error={signinError} /> : <Closed />;
  }
  return (
    <div className="inbox" data-screen="inbox" data-tab={tab}>
      <InboxHead tab={tab} />
      {children}
    </div>
  );
}
