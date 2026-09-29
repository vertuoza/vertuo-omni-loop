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

export const HOME_PATH = '/app';

export function Dashboard({ dashboard, query }: { dashboard: DashboardData; query: Query }) {
  const note = dashboard.solo
    ? <p className="dash-note">No fleet of your own. <a href={FLEET_PATH}>See a fleet’s board on Fleet</a></p>
    : undefined;
  return (
    <div className="dash">
      <You name={dashboard.name} you={dashboard.you} season={dashboard.season} />
      <WaitingTile part={dashboard.waiting} />
      <Board board={dashboard.board} path={HOME_PATH} query={query} peopleTitle="Your team" peopleNote={note} />
    </div>
  );
}
