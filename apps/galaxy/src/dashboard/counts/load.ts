import { readForMe, readTabs } from '../../ask/page/source';
import { settle, type PartInput, type PartLoader, type Read } from '../part';
import { waitingCount, type Waiting } from './counts';

// The four counts (PRD 328, slice s5), each a tile with a label and a number: questions answered,
// outbox items settled and PRDs created this season (the UTC month), and the questions waiting for you
// now. Each is read on its own, as the signed-in person, and one that fails reads 'unreadable' alone,
// its error logged: the other tiles still count.
//
// | tile               | read                                                                          |
// |--------------------|-------------------------------------------------------------------------------|
// | Questions answered | ask_rounds whose answered_by is you, with answered_at this season               |
// | Outbox settled     | ledger_events of the workspace, WOUND_CLOSED, id `outbox:…`, contributor your login, this season |
// | PRDs created       | contributions of the workspace, kind prd-opened, login yours, this season       |
// | Waiting for you    | readTabs and readForMe, the ask pages' own readers, counted by waitingCount     |
//
// The two that count by GitHub login read 'no-github' for a person with none linked; the two that
// count the ask tables need no GitHub. A login is compared ignoring case (ilike: a GitHub login holds
// only letters, digits and hyphens, so it is a pattern that matches itself). The ask tables are read
// as the ask pages read them, across the person's workspaces; the game's tables of the workspace shown
// only. The database counts, so no row comes back.

/** A count that needs your GitHub login, for a person with none linked: the tile says to link it. */
export const NO_GITHUB = 'no-github';
export type NoGithub = typeof NO_GITHUB;

/** What the counts show: each tile's number, or why it has none. */
export interface CountsValue {
  /** Questions answered: the ask rounds you answered this season, on the page or in the terminal. */
  answered: Read<number>;
  /** Outbox settled: the outbox items the ledger credits you with settling this season. */
  settled: Read<number> | NoGithub;
  /** PRDs created: the `omni:prd` issues you opened this season. */
  prds: Read<number> | NoGithub;
  /** Waiting for you: the questions waiting for you now, and where the tile links. */
  waiting: Read<Waiting>;
}

type Counted = { count: number | null; error: { message: string } | null };

/** A count the database made: its number, never a guess. */
async function counted(what: string, query: PromiseLike<Counted>): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(`Supabase: could not read ${what} (${error.message})`);
  if (typeof count !== 'number') throw new Error(`Supabase: ${what} came back with no count`);
  return count;
}

const HEAD = { count: 'exact', head: true } as const;
const bounds = ({ season }: PartInput) => [season.from.toISOString(), season.to.toISOString()] as const;

function answered(input: PartInput) {
  const [from, to] = bounds(input);
  return counted('ask_rounds', input.db.from('ask_rounds').select('id', HEAD)
    .eq('answered_by', input.userId).gte('answered_at', from).lt('answered_at', to));
}

function settled(input: PartInput, login: string) {
  const [from, to] = bounds(input);
  return counted('ledger_events', input.db.from('ledger_events').select('id', HEAD)
    .eq('workspace_id', input.workspace).eq('type', 'WOUND_CLOSED').like('id', 'outbox:%')
    .ilike('contributor', login).gte('at', from).lt('at', to));
}

function prds(input: PartInput, login: string) {
  const [from, to] = bounds(input);
  return counted('contributions', input.db.from('contributions').select('number', HEAD)
    .eq('workspace_id', input.workspace).eq('kind', 'prd-opened')
    .ilike('login', login).gte('at', from).lt('at', to));
}

async function waiting({ db, userId, now }: PartInput): Promise<Waiting> {
  const [tabs, forMe] = await Promise.all([readTabs(db, userId, now.getTime()), readForMe(db, userId)]);
  return waitingCount(tabs, forMe, now.getTime());
}

/** The counts' read: each tile on its own. */
export const loadCounts: PartLoader<CountsValue> = async (input) => {
  const { login } = input;
  const byLogin = (what: string, read: (login: string) => Promise<number>): Promise<Read<number> | NoGithub> =>
    (login ? settle(what, () => read(login)) : Promise.resolve(NO_GITHUB));
  const [answeredN, settledN, prdsN, waitingN] = await Promise.all([
    settle('the questions you answered', () => answered(input)),
    byLogin('the outbox items you settled', (l) => settled(input, l)),
    byLogin('the PRDs you created', (l) => prds(input, l)),
    settle('the questions waiting for you', () => waiting(input)),
  ]);
  return { answered: answeredN, settled: settledN, prds: prdsN, waiting: waitingN };
};
