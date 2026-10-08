// A member's writes on an ideas board (PRD 1246, s4), as the signed-in person, so row-level security
// has the last word: only a member of the repository's workspace adds or changes an idea, and nobody
// deletes one (supabase/migrations/20261114090000_ideas.sql). An add files the idea as the terminal's
// `omni idea add` does (../api/store.ts). A change that touches no row was refused: row-level security
// hides an idea a person may not change rather than failing. Each write answers its refusal in plain
// words, or null. Also the read behind Work › Ideas: which board of the workspace the sidebar opens.
import { z } from 'zod';
import { orThrow, parseRows } from '../../data/parse-rows';
import { ideasPort, IdeasRefusal, type IdeasApiDb, type NewIdeaRow } from '../api/store';
import type { IdeaChange } from './members';
import { MEMBERS } from './words';

export type MembersDb = IdeasApiDb;

export interface MembersPort {
  add(idea: NewIdeaRow): Promise<string | null>;
  change(id: string, change: IdeaChange): Promise<string | null>;
}

const WHERE_CHANGE = 'ideas/members/store: ideas';
const WHERE_BOARD = 'ideas/members/store: repositories';

const Changed = z.strictObject({ id: z.uuid() });
const Listed = z.strictObject({ full_name: z.string() });

/** The database's refusals of a change, by code; anything else is a failure. */
const REFUSED: Readonly<Record<string, string>> = { '42501': MEMBERS.notMember, '23514': MEMBERS.broken };

/** A failure the person reads as "try again"; its reason goes to the log only. */
function failed(where: string, reason: unknown): string {
  console.error(`${where}: ${reason instanceof Error ? reason.message : String(reason)}`);
  return MEMBERS.failed;
}

export function membersPort(db: MembersDb): MembersPort {
  return {
    async add(idea) {
      try {
        await ideasPort(db).add(idea);
        return null;
      } catch (error) {
        return error instanceof IdeasRefusal ? error.message : failed('ideas/members/store: add', error);
      }
    },
    async change(id, change) {
      const { data, error } = await db.from('ideas').update(change).eq('id', id).select('id');
      if (error) return REFUSED[error.code] ?? failed(WHERE_CHANGE, error.message);
      const changed = parseRows(Changed, data, WHERE_CHANGE);
      if (!changed.ok) return MEMBERS.failed;
      return changed.value.length ? null : MEMBERS.notMember;
    },
  };
}

/** The board Work › Ideas opens: the workspace's public one first, else its first repository's; null
 * when it lists none. */
export async function workspaceBoard(db: MembersDb, workspace: string): Promise<string | null> {
  const { data, error } = await db.from('repositories').select('full_name').eq('workspace_id', workspace)
    .order('public_ideas', { ascending: false }).order('added_at').limit(1);
  if (error) throw new Error(`${WHERE_BOARD}: ${error.message}`);
  return orThrow(parseRows(Listed, data, WHERE_BOARD))[0]?.full_name ?? null;
}
