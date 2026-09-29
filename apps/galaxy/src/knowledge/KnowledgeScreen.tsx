import { Notice } from '../ask/page/Notice';
import { SwitchAccount } from '../ask/page/SignInCard';
import type { KnowledgeView, RepoMenu } from './access';
import { KnowledgeMap } from './KnowledgeMap';
import { KnowledgeSignIn } from './KnowledgeSignIn';
import { RepoPicker } from './RepoPicker';
import { knowledgeCallbackPath } from './sign-in';
import { select } from './view';

// The /knowledge page, in each of its states, inside the app shell (PRD 438), which draws the sidebar
// and the top bar: the page's own heading (the repository it reads: a menu when the crew has others to
// pick from, else a chip; and the star chart, which shows the deployed checkout only), then the map
// for the crew (and the demo), or the card that says why there is none. Only the map state holds the
// graph; every other state renders from nothing but its kind and the menu, so its markup cannot carry
// an entry.

type Supabase = { url: string; key: string };

export type KnowledgeScreenProps = {
  view: KnowledgeView;
  /** What the address asked for: `?repo=&domain=&entry=`. */
  wanted: { repo?: string | null; domain: string | null; entry: string | null };
  supabase: Supabase | null;
  signinError: string | null;
};

const menuOf = (view: KnowledgeView): RepoMenu | null => ('menu' in view ? view.menu : null);

function KnowledgeHead({ repo, menu }: { repo: string | null; menu: RepoMenu | null }) {
  const home = !menu || menu.current === '';
  return (
    <div className="km-page-head">
      {menu ? <RepoPicker menu={menu} /> : repo && <code className="km-repo">{repo}</code>}
      {home && <a className="km-chart" href="/#chart">Open the star chart →</a>}
    </div>
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
            You are signed in with an account outside the crew. Sign in with the GitHub account that belongs to your
            workspace&apos;s org to read the knowledge map.
          </p>
          {supabase && <SwitchAccount supabase={supabase} />}
        </Notice>
      );
    case 'out-of-reach': {
      const picked = view.menu?.current || null;
      return (
        <Notice title="The knowledge is out of reach">
          <p className="ask-muted">
            {picked
              ? `The knowledge of ${picked} could not be read from GitHub; this deployment's log says why. Reload the page in a moment.`
              : 'This deployment could not read its knowledge folder; its log says why. Reload the page in a moment.'}
          </p>
        </Notice>
      );
    }
    case 'not-offered':
      return (
        <Notice title="This repository is not on the menu">
          <p className="ask-muted">
            {`${view.repo} is not a repository of your workspaces set up with Omni Loop, or the Omni Loop App cannot read it.`}
            {view.menu ? ' Pick one from the menu above.' : ''}
          </p>
        </Notice>
      );
    case 'map': {
      const initial = select(view.graph, wanted);
      if (!initial) {
        return (
          <Notice title="No knowledge yet">
            <p className="ask-muted">
              This repository&apos;s knowledge base holds no principle, rule or invariant yet. Running <code>/omni:invade</code> in
              it proposes one from what the repository can prove.
            </p>
          </Notice>
        );
      }
      return <KnowledgeMap graph={view.graph} initial={initial} repo={view.menu?.current || null} />;
    }
  }
}

export function KnowledgeScreen(props: KnowledgeScreenProps) {
  return (
    <div className="km-main">
      <KnowledgeHead repo={props.view.kind === 'map' ? props.view.graph.repo : null} menu={menuOf(props.view)} />
      <Body {...props} />
    </div>
  );
}
