import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import { SETTINGS_TABS } from '../nav/section-tabs';
import { APP_HOME } from '../switch/switch';
import { RepositoriesPage, type RepositoriesPageProps } from './RepositoriesPage';

// Settings → Repositories in each situation (PRD 612 s1), decided once by the page: no database here;
// signed out (sign in on /app, then come back); an account in no workspace; the list that could not be
// read; or the list itself, the owner's to change and a member's to read.
// Every situation starts with the Settings tabs, Fleets · Repositories (PRD 733).

export type RepositoriesScreenView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'repositories' } & RepositoriesPageProps);

export function RepositoriesScreen({ view }: { view: RepositoriesScreenView }) {
  return (
    <>
      <SectionTabs label="Settings" tabs={SETTINGS_TABS} current="/app/settings/repositories" />
      <RepositoriesBody view={view} />
    </>
  );
}

function RepositoriesBody({ view }: { view: RepositoriesScreenView }) {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="Repositories are not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s repositories.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your repositories">
          <p className="ask-muted">Your workspace’s repositories are for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">Repositories belong to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your repositories" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
    case 'repositories': {
      return <RepositoriesPage source={view.source} owner={view.owner} repositories={view.repositories} access={view.access} now={view.now} products={view.products} />;
    }
  }
}
