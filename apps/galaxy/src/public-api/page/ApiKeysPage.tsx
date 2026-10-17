import { Notice } from '../../ask/page/Notice';
import { SectionTabs } from '../../nav/SectionTabs';
import { SETTINGS_TABS } from '../../nav/section-tabs';
import { APP_HOME } from '../../switch/switch';
import { ApiKeysPanel } from './ApiKeysPanel';
import { API_KEYS_HREF, type ApiKeysPageView } from './model';

// Settings › API keys in each situation (PRD 2022 s1), decided once by the page: no database here;
// signed out; an account in no workspace; the keys that could not be read; or the keys themselves, an
// owner's to make and revoke and a member's to read. Every situation starts with the Settings tabs, API
// keys marked.

function Body({ view, now }: { view: ApiKeysPageView; now: string }) {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="API keys are not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s keys.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your API keys">
          <p className="ask-muted">Your workspace’s API keys are for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">API keys belong to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your API keys" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
    case 'keys':
      return <ApiKeysPanel source={view.source} owner={view.owner} keys={view.keys} tracked={view.tracked} now={now} />;
  }
}

export function ApiKeysPage({ view, now }: { view: ApiKeysPageView; now: string }) {
  return (
    <>
      <SectionTabs label="Settings" tabs={SETTINGS_TABS} current={API_KEYS_HREF} />
      <Body view={view} now={now} />
    </>
  );
}
