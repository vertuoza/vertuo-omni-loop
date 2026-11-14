import { Notice } from '../../ask/page/Notice';
import { SwitchAccount } from '../../ask/page/SignInCard';
import { DashboardSignIn } from '../DashboardSignIn';
import { CouldNotLoad } from '../Notes';
import { FleetChip } from '../../people/FleetChip';
import { UNREADABLE, type Read } from '../part';
import { fleetTagOf, type FleetRank } from '../rankings/rank';
import { APP_CALLBACK } from '../sign-in';
import { Board } from '../board/Board';
import { hrefWith, type Query } from '../board/links';
import { NewVirtualFleet } from '../../virtual-fleets/drawer/NewVirtualFleet';
import type { FleetBoard, VirtualOf } from './fleet';
import type { FleetHead } from './load';
import './fleet.css';

// /app/fleet in each situation (PRD 572), decided once by the page: a fleet's board, headed by its
// name and its place this season, under the picker of every fleet; the picker alone with *Pick a
// fleet to see its board*, for a viewer with no fleet or a `?fleet` that names none; *This workspace
// has no fleet yet*, linking to Settings › Fleets; and, as on Workspace, closed, signed out and in no
// workspace. The picker's links keep the rest of the query, so picking a fleet keeps the period.
// PRD 652: each picker link and the page's header name the fleet as its FleetChip, its mascot in its
// colour.
// PRD 2842 s1: `+ New virtual fleet` closes the row of chips, and is the page's main button when the
// workspace has no fleet yet; it opens the New virtual fleet drawer. A virtual fleet's chip says so.

type Supabase = { url: string; key: string };

const FLEET_PATH = '/app/fleet';
/** Where a workspace's fleets are made (PRD 572 moves them under Settings). */
const FLEETS_SETTINGS_PATH = '/app/settings/fleets';

const FLEET_LINE = {
  pick: 'Pick a fleet to see its board',
  none: 'This workspace has no fleet yet',
  noneYet: 'No fleet yet.',
  players: ' for a players’ fleet',
  virtual: '· virtual',
} as const;

export type FleetView = { kind: 'closed' } | { kind: 'sign-in' } | FleetBoard;

export interface FleetScreenProps {
  view: FleetView;
  supabase: Supabase | null;
  signinError: string | null;
  query: Query;
}

function Closed() {
  return (
    <Notice title="The fleet board is not open here">
      <p className="ask-muted">This deployment has no database, so it knows nobody’s work.</p>
    </Notice>
  );
}

/** The New virtual fleet button, when the read says where it makes the fleet. */
function NewFleet({ virtual, primary = false }: { virtual: VirtualOf | undefined; primary?: boolean }) {
  return virtual ? <NewVirtualFleet workspace={virtual.workspace} mascots={virtual.mascots} primary={primary} /> : null;
}

/** No fleet yet: a virtual fleet is made right here, a players' fleet in Settings › Fleets. */
function NoFleetYet({ virtual }: { virtual: VirtualOf }) {
  return (
    <>
      <p className="fleet-line">{FLEET_LINE.noneYet}</p>
      <NewFleet virtual={virtual} primary />
      <p className="fleet-line ask-muted"><a href={FLEETS_SETTINGS_PATH}>Settings › Fleets</a>{FLEET_LINE.players}</p>
    </>
  );
}

function NoWorkspace({ supabase }: { supabase: Supabase | null }) {
  return (
    <Notice title="Your account is not in a workspace">
      <p className="ask-muted">The fleet board is for the members of a workspace. Sign in with your GitHub account to see yours.</p>
      {supabase && <SwitchAccount supabase={supabase} />}
    </Notice>
  );
}

function Picker({ fleets, current, query, virtual }: { fleets: Read<FleetRank[]>; current: string | null; query: Query; virtual: VirtualOf | undefined }) {
  return (
    <nav className="fleet-picker" aria-label="Fleets">
      {fleets === UNREADABLE ? <CouldNotLoad /> : (
        <ul>
          {fleets.map((f) => (
            <li key={f.name}>
              <a href={hrefWith(FLEET_PATH, query, { fleet: f.name })} aria-current={f.name === current ? 'page' : undefined}>
                <FleetChip fleet={fleetTagOf(f)} link={false} />
                {virtual?.names.includes(f.name) && <span className="fleet-virtual">{FLEET_LINE.virtual}</span>}
                {f.yours && <span className="fleet-yours"><span aria-hidden="true"> ◀</span><span className="ask-sr"> (your fleet)</span></span>}
              </a>
            </li>
          ))}
          {virtual && <li><NewFleet virtual={virtual} /></li>}
        </ul>
      )}
    </nav>
  );
}

function Place({ place, season }: { place: FleetHead['place']; season: string }) {
  if (place === UNREADABLE) return <p className="dash-places">{`${season} place: couldn’t load it`}</p>;
  if (place === null) return <p className="dash-places">{`Not ranked in ${season}`}</p>;
  return <p className="dash-places">{`#${place.rank} of ${place.of} fleets · ${season}`}</p>;
}

export function FleetScreen({ view, supabase, signinError, query }: FleetScreenProps) {
  switch (view.kind) {
    case 'closed':
      return <Closed />;
    case 'sign-in':
      return supabase ? <DashboardSignIn supabase={supabase} returnPath={APP_CALLBACK} error={signinError} /> : <Closed />;
    case 'no-workspace':
      return <NoWorkspace supabase={supabase} />;
    case 'none':
      return (
        <div className="dash">
          <h1 className="dash-name">Fleet</h1>
          {view.virtual ? <NoFleetYet virtual={view.virtual} /> : (
            <p className="fleet-line">{FLEET_LINE.none}. <a href={FLEETS_SETTINGS_PATH}>Settings › Fleets</a></p>
          )}
        </div>
      );
    case 'pick':
      return (
        <div className="dash">
          <h1 className="dash-name">Fleet</h1>
          <Picker fleets={view.fleets} current={null} query={query} virtual={view.virtual} />
          <p className="fleet-line">{FLEET_LINE.pick}</p>
        </div>
      );
    case 'board': {
      return (
        <div className="dash">
          <Picker fleets={view.fleets} current={view.fleet.name} query={query} virtual={view.virtual} />
          <header className="fleet-head">
            <h1 className="dash-name"><FleetChip fleet={view.fleet} link={false} /></h1>
            <Place place={view.fleet.place} season={view.board.season.name} />
          </header>
          <Board board={view.board} path={FLEET_PATH} query={query} />
        </div>
      );
    }
  }
}
