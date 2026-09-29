import type { CSSProperties } from 'react';
import { Notice } from '../../ask/page/Notice';
import { SwitchAccount } from '../../ask/page/SignInCard';
import { DashboardSignIn } from '../DashboardSignIn';
import { CouldNotLoad } from '../Notes';
import { UNREADABLE, type Read } from '../part';
import type { FleetRank } from '../rankings/rank';
import { APP_CALLBACK } from '../sign-in';
import { Board } from '../board/Board';
import { hrefWith, type Query } from '../board/links';
import type { FleetBoard } from './fleet';
import type { FleetHead } from './load';
import './fleet.css';

// /app/fleet in each situation (PRD 572), decided once by the page: a fleet's board, headed by its
// name and its place this season, under the picker of every fleet; the picker alone with *Pick a
// fleet to see its board*, for a viewer with no fleet or a `?fleet` that names none; *This workspace
// has no fleet yet*, linking to Settings › Fleets; and, as on Workspace, closed, signed out and in no
// workspace. The picker's links keep the rest of the query, so picking a fleet keeps the period.

type Supabase = { url: string; key: string };

export const FLEET_PATH = '/app/fleet';
/** Where a workspace's fleets are made (PRD 572 moves them under Settings). */
export const FLEETS_SETTINGS_PATH = '/app/settings/fleets';

export const FLEET_LINE = {
  pick: 'Pick a fleet to see its board',
  none: 'This workspace has no fleet yet',
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

function Picker({ fleets, current, query }: { fleets: Read<FleetRank[]>; current: string | null; query: Query }) {
  return (
    <nav className="fleet-picker" aria-label="Fleets">
      {fleets === UNREADABLE ? <CouldNotLoad /> : (
        <ul>
          {fleets.map((f) => (
            <li key={f.name}>
              <a href={hrefWith(FLEET_PATH, query, { fleet: f.name })} aria-current={f.name === current ? 'page' : undefined}>
                {f.label}
                {f.yours && <span className="fleet-yours"><span aria-hidden="true"> ◀</span><span className="ask-sr"> (your fleet)</span></span>}
              </a>
            </li>
          ))}
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
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">The fleet board is for the members of a workspace. Sign in with your GitHub account to see yours.</p>
          {supabase && <SwitchAccount supabase={supabase} />}
        </Notice>
      );
    case 'none':
      return (
        <div className="dash">
          <h1 className="dash-name">Fleet</h1>
          <p className="fleet-line">{FLEET_LINE.none}. <a href={FLEETS_SETTINGS_PATH}>Settings › Fleets</a></p>
        </div>
      );
    case 'pick':
      return (
        <div className="dash">
          <h1 className="dash-name">Fleet</h1>
          <Picker fleets={view.fleets} current={null} query={query} />
          <p className="fleet-line">{FLEET_LINE.pick}</p>
        </div>
      );
    case 'board': {
      const style = view.fleet.color ? ({ '--dash-fleet': view.fleet.color } as CSSProperties) : undefined;
      return (
        <div className="dash">
          <Picker fleets={view.fleets} current={view.fleet.name} query={query} />
          <header className="fleet-head" style={style}>
            <h1 className="dash-name dash-fleet"><span className="dash-fleet-pip" aria-hidden="true" />{view.fleet.label}</h1>
            <Place place={view.fleet.place} season={view.board.season.name} />
          </header>
          <Board board={view.board} path={FLEET_PATH} query={query} />
        </div>
      );
    }
  }
}
