import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Player } from '../../arcade/types';
import { loadFleets, loadGalaxy, loadMe } from '../../data/load-galaxy';
import type { WaitingQuestion } from '../../waiting/waiting';
import { loadBoard, supabaseReads, type BoardValue } from '../board/load';
import type { Period } from '../board/period';
import type { Waiting } from '../counts/counts';
import { waitingOfQuestions } from '../counts/load';
import { homeRequest } from '../home/team';
import { once, settle, UNREADABLE, type PartInput, type Read } from '../part';
import { seasonBounds, type Season } from '../season';
import { loadYou, loginOf, nameOf, type YouValue } from '../you';

// Home's reads, started at once and never awaited here (PRD 657 s4): the page hands each part's
// promise to its own streamed block (./HomeStream.tsx), so a slow part holds up only itself. They are
// load.ts's reads, in the workspace the page already knows the person is in: their player row first,
// which says who they are to the game (their login and their fleet), then the hero block and the
// board, each on its own. Waiting for you is counted from the questions the layout read for this
// request (src/data/viewer.ts), and waits for nothing else. The galaxy is read once, for the hero
// block and the board. No promise here rejects: a read that fails reads 'unreadable', its error
// logged, as load.ts's do.

export interface HomeParts {
  season: Season;
  /** The page's one heading and the hero block. */
  you: Promise<{ name: string; you: Read<YouValue> }>;
  waiting: Promise<Read<Waiting>>;
  /** The board with scope *you*, and whether there is no team to show (the line to Fleet). */
  board: Promise<{ board: BoardValue; solo: boolean }>;
}

export function homeParts(
  db: SupabaseClient, user: User, workspace: string, period: Period, now: Date, questions: () => Promise<WaitingQuestion[]>,
): HomeParts {
  const season = seasonBounds(now);
  const galaxy = once(() => loadGalaxy(db, workspace, now));
  const me = settle<Player | null>('your player', () => loadMe(db, workspace, user.id));
  const who = me.then((read) => {
    const player = read === UNREADABLE ? null : read;
    const input: PartInput = {
      db, workspace, userId: user.id, login: loginOf(player, user), team: player?.team ?? null, now, season, galaxy,
    };
    return { read, player, input };
  });
  return {
    season,
    you: who.then(async ({ read, player, input }) => ({
      name: nameOf(player, user),
      you: await settle('your hero', () => loadYou(input, read, () => loadFleets(db, workspace))),
    })),
    waiting: settle('the questions waiting for you', async () => waitingOfQuestions(await questions())),
    board: who.then(async ({ input }) => {
      const home = homeRequest({ userId: user.id, login: input.login, team: input.team });
      const board = await loadBoard(supabaseReads(db, workspace, galaxy), { scope: home.scope, people: home.people, viewerId: user.id, period, now });
      return { board, solo: home.solo };
    }),
  };
}
