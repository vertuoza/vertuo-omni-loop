import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import { SETTINGS_TABS } from '../nav/section-tabs';
import { APP_HOME } from '../switch/switch';
import type { Claim, Product } from './model';
import { faceOf } from '../people/face';
import { BusinessPage, type BusinessPageProps, type Constituents } from './BusinessPage';
import type { Persona } from './personas';

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

/** The demo's account: the owner, so every control of the Constituents panel can be tried. */
const DEMO_ME = 'demo-you';

/** The demo's constituents (PRD 871 s2): none yet, as in every new workspace; what the demo's owner
 * adds stays in the page, history included. */
export const DEMO_CONSTITUENTS: Constituents = {
  constituents: [], events: [], owner: true, me: DEMO_ME,
  people: { [DEMO_ME]: { name: 'You', face: faceOf({ name: 'You' }) } },
};

/** The demo's one product (PRD 748 s4): "+ Add a product" adds a second, in the page only. */
export const DEMO_PRODUCTS: Product[] = [{ id: 'demo-product-1', name: 'Acme ERP' }];

/** The demo's sample personas (PRD 799 s3): a small cast of kinds of customer, naming no real company
 * or person. */
export const DEMO_PERSONAS: Persona[] = [
  {
    id: 'demo-persona-1', product: 'demo-product-1', ordinal: 1, name: 'Marc', stance: 'skeptical', trade: 'plumber',
    avatar: { v: 1, skin: 1, hair: 5, hairColor: 1, outfit: 0, accessory: 1 },
    who: 'Plumber, runs his own company of 5 plumbers. Does his quotes at night on his phone.',
    usage: 'Mostly the quotes and the dashboard.',
  },
  {
    id: 'demo-persona-2', product: 'demo-product-1', ordinal: 2, name: 'Sofia', stance: 'excited', trade: 'office',
    avatar: { v: 1, skin: 3, hair: 3, hairColor: 0, outfit: 0, accessory: 2 },
    who: 'Keeps a 20-person renovation company running: invoices, planning, suppliers.',
    usage: 'Invoices, planning and supplier orders, every day.',
  },
  {
    id: 'demo-persona-3', product: 'demo-product-1', ordinal: 3, name: 'Yves', stance: 'neutral', trade: 'electrician',
    avatar: { v: 1, skin: 0, hair: 0, hairColor: 3, outfit: 1, accessory: 3 },
    who: 'Two-person electrical company, works mostly for other builders.',
    usage: 'Quotes and time on site.',
  },
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
