import { Notice } from '../ask/page/Notice';
import { SwitchAccount } from '../ask/page/SignInCard';
import { TopBar } from '../nav/TopBar';
import type { KnowledgeView } from './access';
import { KnowledgeMap } from './KnowledgeMap';
import { KnowledgeSignIn } from './KnowledgeSignIn';
import { knowledgeCallbackPath } from './sign-in';
import { select } from './view';

// The /knowledge page, in each of its states: the app's one top bar (TopBar, PRD 346: its OMNI LOOP
// mark a link to /app, the star chart before its menu, and Game mode its last control: PRD 238), then the map for the crew (and the demo), or the card that
// says why there is none. Only the map state holds the graph; every other state renders from nothing
// but its kind, so its markup cannot carry an entry.

type Supabase = { url: string; key: string };

export type KnowledgeScreenProps = {
  view: KnowledgeView;
  /** What the address asked for: `?domain=&entry=`. */
  wanted: { domain: string | null; entry: string | null };
  supabase: Supabase | null;
  signinError: string | null;
};

function KnowledgeBar({ repo }: { repo: string | null }) {
  return (
    <TopBar
      sub="Knowledge map"
      brandExtra={repo && <code className="km-repo">{repo}</code>}
      extras={<a className="km-chart" href="/#chart">Open the star chart →</a>}
      classes={{ bar: 'km-bar', brand: 'km-brand', end: 'km-bar-end' }}
    />
  );
}

const closed = (
  <Notice title="The knowledge map is not open here">
    <p className="ask-muted">This deployment has no database, so it cannot tell who is crew.</p>
  </Notice>
);

function Body({ view, wanted, supabase, signinError }: KnowledgeScreenProps) {
  switch (view.kind) {
    case 'closed':
      return closed;
    case 'sign-in':
      return supabase ? <KnowledgeSignIn supabase={supabase} returnPath={knowledgeCallbackPath(wanted)} error={signinError} /> : closed;
    case 'crew-only':
      return (
        <Notice title="The knowledge map is for the crew">
          <p className="ask-muted">
            You are signed in with an account outside the crew. Sign in with your Vertuoza Google account to read the
            knowledge map.
          </p>
          {supabase && <SwitchAccount supabase={supabase} />}
        </Notice>
      );
    case 'out-of-reach':
      return (
        <Notice title="The knowledge is out of reach">
          <p className="ask-muted">This deployment could not read its knowledge folder; its log says why. Reload the page in a moment.</p>
        </Notice>
      );
    case 'map': {
      const initial = select(view.graph, wanted);
      if (!initial) {
        return (
          <Notice title="No knowledge yet">
            <p className="ask-muted">This repository&apos;s knowledge base holds no principle, rule or invariant yet.</p>
          </Notice>
        );
      }
      return <KnowledgeMap graph={view.graph} initial={initial} />;
    }
  }
}

export function KnowledgeScreen(props: KnowledgeScreenProps) {
  return (
    <>
      <KnowledgeBar repo={props.view.kind === 'map' ? props.view.graph.repo : null} />
      <main className="ask-main km-main">
        <Body {...props} />
      </main>
    </>
  );
}
