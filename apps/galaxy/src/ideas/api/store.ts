// The ideas board's storage, as the terminal's calls reach it (PRD 1246, s2): a Supabase client acting as
// the caller's access token, never a service key, so row-level security has the last word
// (supabase/migrations/20261114090000_ideas.sql).
//
// - `add` files the idea in the caller's own workspace that lists the repository: the one repository
//   row the caller may read for it (a member reads only their workspace's), the earliest added. None is
//   the refusal `No workspace of yours lists <repo>.`; the database refuses anyone else's insert anyway.
// - `board` is s1's read, ideas_board(), as the caller: the board with whether the caller is a member,
//   or null when it is private to them or missing.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../../supabase/database.types.ts';
import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import type { Board, Lane } from '../model';
import { readBoard } from '../store';

/** An idea as the terminal sends it, checked: its board's repository (owner/name, lower-cased). */
export type NewIdeaRow = { repo: string; title: string; pitch: string; lane: Lane };

/** What the API asks of the storage. */
export type IdeasPort = {
  add(row: NewIdeaRow): Promise<{ id: string }>;
  board(repo: string): Promise<Board | null>;
};

/** A refusal the caller is told about, in plain words (ADR-0029). Any other error is the database failing. */
export class IdeasRefusal extends Error {
  status: 400 | 403;
  constructor(status: 400 | 403, reason: string) {
    super(reason);
    this.name = 'IdeasRefusal';
    this.status = status;
  }
}

export const WHERE_REPOSITORY = 'ideas/api/store: repositories';
const WHERE_ADDED = 'ideas/api/store: ideas';

/** The repository row `add` reads: which of the caller's workspaces lists it. */
export const ListingRow = z.strictObject({ workspace_id: z.uuid() });
const AddedRow = z.strictObject({ id: z.uuid() });

/** The database's refusals of an insert, by code; anything else is a failure. */
const REFUSED: Readonly<Record<string, 400 | 403>> = { '42501': 403, '23503': 403, '23514': 400 };

export type IdeasApiDb = Pick<SupabaseClient<Database>, 'from' | 'rpc'>;

/** The query `add` reads the caller's listing with, shared with its boundary file. */
export const listingOf = (db: IdeasApiDb, repo: string) =>
  db.from('repositories').select('workspace_id').eq('full_name', repo).order('added_at').limit(1);

export function ideasPort(db: IdeasApiDb): IdeasPort {
  return {
    async add(row) {
      const listing = await listingOf(db, row.repo);
      if (listing.error) throw new Error(`${WHERE_REPOSITORY}: ${listing.error.message}`);
      const [owner] = orThrow(parseRows(ListingRow, listing.data, WHERE_REPOSITORY));
      if (!owner) throw new IdeasRefusal(403, `No workspace of yours lists ${row.repo}.`);
      const added = await db.from('ideas').insert({ workspace_id: owner.workspace_id, ...row }).select('id').single();
      if (added.error) {
        const status = REFUSED[added.error.code];
        if (status) throw new IdeasRefusal(status, status === 403 ? `Only a member of the workspace adds an idea to ${row.repo}.` : 'The idea breaks a rule of the board.');
        throw new Error(`${WHERE_ADDED}: ${added.error.message}`);
      }
      return { id: orThrow(parseRow(AddedRow, added.data, WHERE_ADDED)).id };
    },
    board: (repo) => readBoard(db, repo),
  };
}
