import { BoardSkeleton, HeroSkeleton, TilesSkeleton } from '../../skeleton/Skeleton';
import { Streamed } from '../../skeleton/Streamed';
import { Board } from '../board/Board';
import type { Query } from '../board/links';
import { WaitingTile } from '../counts/WaitingTile';
import { HOME_PATH } from '../Dashboard';
import { FLEET_PATH } from '../home/team';
import { You } from '../YouBlock';
import type { HomeParts } from './home';

// Home, /app, streamed (PRD 657 s4): Dashboard.tsx's three parts in its order (you, Waiting for you,
// the board with scope *you*), each in its own block with a skeleton of its size, so the page's
// column is sent at once and each part fills in as its read arrives. A slow part holds up only
// itself; one whose read fails says so in its place, and the others render.

const SOLO_NOTE = <p className="dash-note">No fleet of your own. <a href={FLEET_PATH}>See a fleet’s board on Fleet</a></p>;

export function HomeStream({ parts, query }: { parts: HomeParts; query: Query }) {
  return (
    <div className="dash">
      <Streamed read={parts.you} skeleton={<HeroSkeleton />}>
        {({ name, you }) => <You name={name} you={you} season={parts.season} />}
      </Streamed>
      <Streamed read={parts.waiting} skeleton={<TilesSkeleton what="Waiting for you" count={1} />}>
        {(waiting) => <WaitingTile part={waiting} />}
      </Streamed>
      <Streamed read={parts.board} skeleton={<BoardSkeleton />}>
        {({ board, solo }) => (
          <Board board={board} path={HOME_PATH} query={query} peopleTitle="Your team" peopleNote={solo ? SOLO_NOTE : undefined} />
        )}
      </Streamed>
    </div>
  );
}
