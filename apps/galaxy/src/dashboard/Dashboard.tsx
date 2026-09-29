import { FleetChip } from '../people/FleetChip';
import { SOLO } from '../people/types';
import { Board } from './board/Board';
import type { Query } from './board/links';
import { WaitingTile } from './counts/WaitingTile';
import { FLEET_PATH } from './home/team';
import type { DashboardData } from './load';
import { You } from './YouBlock';

// Home, /app (PRD 328, reshaped by PRD 572), top to bottom: you (the hero block), Waiting for you,
// then the board with scope *you*, whose People table is your team; with no team, your row alone and
// a line to the Fleet page. The rankings, the Outbox settled tile, the week and the season's counts
// left Home with PRD 572: the fleet ranking is on Workspace, the People tables list everyone.
// PRD 652: the People table is headed **Your fleet** and your fleet's chip (its mascot and label in
// its colour), or **Your fleet · SOLO** with no fleet of your own.

const HOME_PATH = '/app';

function FleetTitle({ fleet }: { fleet: DashboardData['board']['peopleFleet'] | undefined }) {
  if (!fleet) return <>Your fleet</>;
  if (fleet === SOLO) return <>Your fleet · <FleetChip fleet={SOLO} size="inline" /></>;
  return <>Your fleet <FleetChip fleet={fleet} size="inline" /></>;
}

export function Dashboard({ dashboard, query }: { dashboard: DashboardData; query: Query }) {
  const note = dashboard.solo
    ? <p className="dash-note">No fleet of your own. <a href={FLEET_PATH}>See a fleet’s board on Fleet</a></p>
    : undefined;
  const fleet = dashboard.solo ? SOLO : dashboard.board.peopleFleet;
  const title = fleet ? <FleetTitle fleet={fleet} /> : 'Your fleet';
  return (
    <div className="dash">
      <You name={dashboard.name} you={dashboard.you} season={dashboard.season} />
      <WaitingTile part={dashboard.waiting} />
      <Board board={dashboard.board} path={HOME_PATH} query={query} peopleTitle={title} peopleNote={note} />
    </div>
  );
}
