import { Notice } from '../../ask/page/Notice';
import { SectionTabs } from '../../nav/SectionTabs';
import { SETTINGS_TABS } from '../../nav/section-tabs';
import { APP_HOME } from '../../switch/switch';
import { JevPage, type JevPageProps } from './JevPage';

// Settings › Jev in each situation (PRD 812 s1), decided once by the page: no database here; signed
// out; an account in no workspace; the settings that could not be read; a deployment without
// SECRETS_MASTER_KEY, where no key can be saved; or the settings themselves, the owner's to change and
// a member's to read. Every situation starts with the Settings tabs.

export const NOT_AVAILABLE_TITLE = 'Jev is not available on this deployment';

export type JevScreenView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'unavailable' }
  | ({ kind: 'jev' } & JevPageProps);

export function JevScreen({ view }: { view: JevScreenView }) {
  return (
    <>
      <SectionTabs label="Settings" tabs={SETTINGS_TABS} current="/app/settings/jev" />
      <JevBody view={view} />
    </>
  );
}

function JevBody({ view }: { view: JevScreenView }) {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="Jev is not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s settings.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your Jev settings">
          <p className="ask-muted">Your workspace’s settings are for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">Jev’s settings belong to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your Jev settings" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
    case 'unavailable':
      return (
        <Notice title={NOT_AVAILABLE_TITLE}>
          <p className="ask-muted">This deployment has no master key to encrypt a TypeSafe key with, so none can be saved. Every decision is made as before.</p>
        </Notice>
      );
    case 'jev': {
      const { kind: _, ...props } = view;
      return <JevPage {...props} />;
    }
  }
}
