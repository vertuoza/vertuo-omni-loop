import { Notice } from '../ask/page/Notice';
import { APP_HOME } from '../switch/switch';
import { FleetsPage, type FleetsPageProps } from './FleetsPage';

// /app/settings/fleets in each situation (PRD 400 s3), decided once by the page: no database here; signed out
// (sign in on /app, then come back); an account in no workspace; the fleets that could not be read;
// or the fleets themselves, the owner's to change and a member's to read.

export type FleetsScreenView =
  | { kind: 'closed' }
  | { kind: 'sign-in' }
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | ({ kind: 'fleets' } & FleetsPageProps);

export function FleetsScreen({ view }: { view: FleetsScreenView }) {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="Fleets are not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s fleets.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your fleets">
          <p className="ask-muted">Your workspace’s fleets are for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">Fleets belong to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your fleets" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
    case 'fleets': {
      const { kind: _, ...props } = view;
      return <FleetsPage {...props} />;
    }
  }
}
