import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import { SETTINGS_TABS } from '../nav/section-tabs';
import { APP_HOME } from '../switch/switch';
import type { Claim } from './model';
import { BusinessPage, type BusinessPageProps } from './BusinessPage';

// Settings → Business in each situation (PRD 748 s2), decided once by the page: no database here;
// signed out (sign in on /app, then come back); an account in no workspace; the business that could
// not be read; or the business itself, any member's to pick and confirm. Every situation starts with
// the Settings tabs, Fleets · Repositories · Business.

export type BusinessScreenView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'business' } & BusinessPageProps);

/** The demo's sample claims: a filled business, some of it cited. No real company is named. */
export const DEMO_CLAIMS: Claim[] = [
  { id: 'demo-1', seq: 1, kind: 'offering', value: 'ERP', source: 'pick', state: 'confirmed', cited: 3, lastBy: 'think-big concept #9' },
  { id: 'demo-2', seq: 2, kind: 'size', value: '2-50', source: 'pick', state: 'confirmed', cited: 3, lastBy: 'think-big concept #9' },
  { id: 'demo-3', seq: 3, kind: 'trade', value: 'construction', source: 'pick', state: 'confirmed', cited: 2, lastBy: 'think-big concept #9' },
  { id: 'demo-4', seq: 4, kind: 'rival', value: 'Acme Build', source: 'pick', state: 'confirmed', cited: 1, lastBy: 'think-big concept #9' },
  { id: 'demo-5', seq: 5, kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', cited: 0, lastBy: null },
];

export function BusinessScreen({ view }: { view: BusinessScreenView }) {
  return (
    <>
      <SectionTabs label="Settings" tabs={SETTINGS_TABS} current="/app/settings/business" />
      <BusinessBody view={view} />
    </>
  );
}

function BusinessBody({ view }: { view: BusinessScreenView }) {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="The business is not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s business.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your business">
          <p className="ask-muted">Your workspace’s business is for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">A business belongs to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your business" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
    case 'business': {
      const { kind: _, ...props } = view;
      return <BusinessPage {...props} />;
    }
  }
}
