import type { ReactNode } from 'react';
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
import { TrailItem } from '../../nav/AppBarItem';
import { HeroesTab } from '../../virtual-fleets/heroes/HeroesTab';
import { CommanderTab } from '../../virtual-fleets/commander/CommanderTab';
import type { FleetBoard } from './fleet';
import { AI_FLEET_PATH, PLAYERS_FLEET_PATH } from './redirect';
import { FleetTabs } from './FleetTabs';
import { tabOf, type FleetTab } from './tabs';
import type { FleetHead } from './load';
import './fleet.css';

// /app/fleet in each situation (PRD 572), decided once by the page: a fleet's board, headed by its
// name and its place this season, under the picker of every fleet; the picker alone with *Pick a
// fleet to see its board*, for a viewer with no fleet or a `?fleet` that names none; *This workspace
// has no fleet yet*, linking to Settings › Fleets; and, as on Workspace, closed, signed out and in no
// workspace. The picker's links keep the rest of the query, so picking a fleet keeps the period.
// PRD 652: each picker link and the page's header name the fleet as its FleetChip, its mascot in its
// colour.
// PRD 2842 s6: on a virtual fleet the page reads tabs, Operation room · Missions · Heroes · Board (`?tab=`), Board
// being today's board unchanged; an ordinary fleet shows only its board.
// PRD 3107 s1: a fifth tab, Commander, after Board, reads its own thread from the browser, so no other tab waits on it.
// PRD 2842 s1: `+ New virtual fleet` closes the row of chips, and is the page's main button when the
// workspace has no fleet yet; it opens the New virtual fleet drawer. A virtual fleet's chip says so.

type Supabase = { url: string; key: string };

const FLEET_PATH = PLAYERS_FLEET_PATH;
/** Where a workspace's fleets are made (PRD 572 moves them under Settings). */
const FLEETS_SETTINGS_PATH = '/app/settings/fleets';

const FLEET_LINE = {
  pick: 'Pick a fleet to see its board',
  none: 'This workspace has no fleet yet',
  soon: 'This tab is not open yet.',
} as const;

export type FleetView = { kind: 'closed' } | { kind: 'sign-in' } | FleetBoard;

export interface FleetScreenProps {
  view: FleetView;
  supabase: Supabase | null;
  signinError: string | null;
  query: Query;
  /** The Missions tab's block (PRD 2842 s7), streamed by the page; absent, the tab is not open. */
  missions?: ReactNode;
  /** The Operation room's block (PRD 2842 s8), streamed by the page; absent, the tab is not open. */
  room?: ReactNode;
}

function Closed() {
  return (
    <Notice title="The fleet board is not open here">
      <p className="ask-muted">This deployment has no database, so it knows nobody’s work.</p>
    </Notice>
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

/** The picker lists the players' fleets only: an AI fleet is on AI Fleet (PRD 3233 s3). */
function Picker({ fleets, current, query, aiNames }: { fleets: Read<FleetRank[]>; current: string | null; query: Query; aiNames: readonly string[] }) {
  return (
    <nav className="fleet-picker" aria-label="Fleets">
      {fleets === UNREADABLE ? <CouldNotLoad /> : (
        <ul>
          {fleets.filter((f) => !aiNames.includes(f.name)).map((f) => (
            <li key={f.name}>
              <a href={hrefWith(FLEET_PATH, query, { fleet: f.name })} aria-current={f.name === current ? 'page' : undefined}>
                <FleetChip fleet={fleetTagOf(f)} link={false} />
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
  const words = place === UNREADABLE ? `${season} place: couldn’t load it` : place === null ? `Not ranked in ${season}` : `#${String(place.rank)} of ${String(place.of)} fleets · ${season}`;
  return <p className="dash-places">{words}</p>;
}

/** The tab's own screen: Heroes is drawn here, the Operation room and Missions by their own slices. */
function TabBody({ tab, view }: { tab: Exclude<FleetTab, 'board'>; view: Extract<FleetBoard, { kind: 'board' }> }) {
  if (tab !== 'heroes') return <p className="fleet-line ask-muted">{FLEET_LINE.soon}</p>;
  return view.heroes ? <HeroesTab view={view.heroes} /> : <CouldNotLoad />;
}

/** The block of a tab read on its own: the page streams Missions and the Operation room, the Commander reads its thread itself. */
const blockOf = (tab: FleetTab, blocks: Record<'missions' | 'room' | 'commander', ReactNode>): ReactNode =>
  (tab === 'missions' || tab === 'room' || tab === 'commander' ? blocks[tab] : undefined);

type BoardOf = Extract<FleetBoard, { kind: 'board' }>;

/** An AI fleet's page on AI Fleet (PRD 3233 s3): its name in the trail, its tabs, the tab asked for. */
function AiBoardScreen({ view, query, missions, room }: { view: BoardOf; query: Query; missions: ReactNode; room: ReactNode }) {
  const tab = tabOf(query.tab);
  const commander = <CommanderTab workspace={view.virtual?.workspace ?? null} fleet={view.fleet.name} />;
  return (
    <div className="dash">
      <TrailItem name={view.fleet.label} />
      <header className="fleet-head">
        <h1 className="dash-name"><FleetChip fleet={view.fleet} link={false} /></h1>
      </header>
      <FleetTabs current={tab} query={query} path={AI_FLEET_PATH} />
      {tab === 'board' ? <Board board={view.board} path={AI_FLEET_PATH} query={query} /> : blockOf(tab, { missions, room, commander }) ?? <TabBody tab={tab} view={view} />}
    </div>
  );
}

/** A players' fleet's board, under the picker of the players' fleets, with its place this season. */
function PlayersBoardScreen({ view, query }: { view: BoardOf; query: Query }) {
  return (
    <div className="dash">
      <Picker fleets={view.fleets} current={view.fleet.name} query={query} aiNames={view.virtual?.names ?? []} />
      <header className="fleet-head">
        <h1 className="dash-name"><FleetChip fleet={view.fleet} link={false} /></h1>
        <Place place={view.fleet.place} season={view.board.season.name} />
      </header>
      <Board board={view.board} path={FLEET_PATH} query={query} />
    </div>
  );
}

export function FleetScreen({ view, supabase, signinError, query, missions, room }: FleetScreenProps) {
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
          <p className="fleet-line">{FLEET_LINE.none}. <a href={FLEETS_SETTINGS_PATH}>Settings › Fleets</a></p>
        </div>
      );
    case 'pick':
      return (
        <div className="dash">
          <h1 className="dash-name">Fleet</h1>
          <Picker fleets={view.fleets} current={null} query={query} aiNames={view.virtual?.names ?? []} />
          <p className="fleet-line">{FLEET_LINE.pick}</p>
        </div>
      );
    case 'board':
      return view.virtual?.names.includes(view.fleet.name) === true ? <AiBoardScreen view={view} query={query} missions={missions} room={room} /> : <PlayersBoardScreen view={view} query={query} />;
  }
}
