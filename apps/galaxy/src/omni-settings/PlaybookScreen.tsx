import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import { SETTINGS_TABS, type SectionTab } from '../nav/section-tabs';
import { APP_HOME } from '../switch/switch';
import type { PlaybookPagesView } from './omni-settings.contract';
import { PlaybookView } from './PlaybookView';

// Settings → Playbook in each situation (PRD 2417, s6), decided once by the page: no database here;
// signed out (sign in on /app, then come back); an account in no workspace; the playbook that could
// not be read; or the playbook itself. Every situation starts with the Settings tabs.

export const PLAYBOOK_PATH = '/app/settings/playbook';

/** The Settings tabs with Playbook after them. */
const PLAYBOOK_TABS: readonly SectionTab[] = [...SETTINGS_TABS, { href: PLAYBOOK_PATH, label: 'Playbook' }];

export type PlaybookScreenView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'playbook' } & PlaybookPagesView);

export function PlaybookScreen({ view }: { view: PlaybookScreenView }) {
  return (
    <>
      <SectionTabs label="Settings" tabs={PLAYBOOK_TABS} current={PLAYBOOK_PATH} />
      <PlaybookBody view={view} />
    </>
  );
}

function PlaybookBody({ view }: { view: PlaybookScreenView }) {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="The playbook is not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s playbook.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your playbook">
          <p className="ask-muted">Your workspace’s playbook is for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">The playbook belongs to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your playbook" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
    case 'playbook':
      return <PlaybookView view={view} />;
  }
}
