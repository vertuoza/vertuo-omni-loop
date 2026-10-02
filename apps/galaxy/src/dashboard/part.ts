import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { GalaxyView } from '@omni/galaxy';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { Season } from './season';

// The contract every part of the dashboard keeps (PRD 328). /app shows the hero block (you.ts), then
// three parts, each in a folder of its own: the week of merges (week/), the four counts (counts/)
// and the rankings (rankings/). Each folder holds four things, and the dashboard's shared files
// compose them, so a part is built, restyled or rewritten inside its folder alone:
//
// | a part's        | its shape                                      | composed by    |
// |-----------------|------------------------------------------------|----------------|
// | loader          | PartLoader<T>: (PartInput) → value or 'unreadable' | load.ts     |
// | view            | (PartProps<T>) → markup, drawn on the server   | Dashboard.tsx  |
// | demo            | PartDemo<T>: (DemoInput) → value               | demo.ts        |
// | stylesheet      | <part>.css, the ask pages' tokens only         | dashboard.css  |
//
// A part's value type T is its own, declared beside its loader: the shared files only carry it.

/** What a part shows when its read failed: it says so, alone, and the rest of the page renders. */
export const UNREADABLE = 'unreadable';
export type Unreadable = typeof UNREADABLE;

/** A part's value, or 'unreadable'. */
export type Read<T> = T | Unreadable;

/** What every part's loader is given, the same for each: who is reading, in which workspace, when. */
export interface PartInput {
  /** The database, as the signed-in person: row-level security decides what each read returns. */
  db: SupabaseClient<Database>;
  /** The id of the workspace shown: every read filters on it. */
  workspace: string;
  /** The signed-in person's id (auth.users; `answered_by`, `owner` and `user_id` hold it). */
  userId: string;
  /**
   * Their GitHub login, in lower case: `players.github_login`, else the account's linked GitHub
   * identity; null when they have neither, and a part that counts by login then says to link it.
   * Every stored login a part compares it with is lower-cased first: logins match ignoring case.
   */
  login: string | null;
  /** Their fleet (`players.team`): null with no player row, or when it could not be read. */
  team: string | null;
  /** When the page renders. */
  now: Date;
  /** The season `now` is in: the UTC month (seasonBounds). */
  season: Season;
  /**
   * The workspace's galaxy (loadGalaxy: the ledger folded by buildGalaxy), read at most once per
   * request however many parts ask for it. It rejects when it cannot be read.
   */
  galaxy: () => Promise<GalaxyView>;
}

/** A part's loader. It resolves with its value, or 'unreadable' once it has logged why; one that
 * throws is read as 'unreadable' too, and its error logged (settle). */
export type PartLoader<T> = (input: PartInput) => Promise<Read<T>>;

/** What every part's demo is given: the demo world, and the demo's *you*, one of its heroes. */
export interface DemoInput {
  now: Date;
  season: Season;
  /** The demo galaxy (demoGalaxy(now)): the demo world's fleets and heroes, scored this season. */
  galaxy: GalaxyView;
  /** The demo *you*'s login, in lower case: one of the demo world's heroes. */
  login: string;
  /** The demo *you*'s fleet: none, *you* play solo (PRD 400). */
  team: string | null;
}

/** A part's demo: its value in the demo, made up and fixed where the demo world has none. */
export type PartDemo<T> = (input: DemoInput) => Read<T>;

/** What every part's view is given: its value (or 'unreadable'), and the season it counts in. */
export interface PartProps<T> {
  part: Read<T>;
  season: Season;
}

/** A read, run on its own: its value, or 'unreadable' with the error logged on the server. */
export async function settle<T>(what: string, read: () => Promise<Read<T>>): Promise<Read<T>> {
  try {
    return await read();
  } catch (error) {
    console.error(`dashboard: ${what} could not be read (${messageOf(error)})`);
    return UNREADABLE;
  }
}

/** A read made once, however many ask for it: every caller shares its one promise. */
export function once<T>(read: () => Promise<T>): () => Promise<T> {
  let made: Promise<T> | null = null;
  return () => (made ??= read());
}
