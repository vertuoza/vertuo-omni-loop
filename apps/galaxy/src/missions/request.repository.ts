import type { SupabaseClient } from '@supabase/supabase-js';
import { IssueNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import { orThrow, parseRow } from '../data/parse-rows';
import type { MadeRequest, MissionRequest, RequestBody } from './missions.contract';

// The mission requests' reads and writes (PRD omni-loop-24 s3), on the signed-in person's own client: row-level security shows a
// request to the members of its workspace and to nobody else, and mission_request_make() (supabase/migrations/
// 20270129130000_mission_requests.sql) saves one and queues its runner job as that person, refusing, before it keeps anything,
// whom the rules refuse. Each answer is parsed where it comes in; a failed read throws. No rule lives here.

export type RequestsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const WHERE = 'missions/request.repository';

const MadeRow = z.object({ id: z.uuid(), repo: z.string(), fleet: z.string(), goal: z.string(), job: z.uuid() });
const RequestRow = z.object({
  id: z.uuid(), repo: z.string(), fleet_key: z.string(), goal: z.string(), requested_login: z.string(),
  mission_number: IssueNumberSchema.nullable(), created_at: z.string(),
});

/** The database's refusal of a press of Start, in its words: its SQLSTATE and the field it names (its hint), when it gives them. */
export type MakeRefusal = { ok: false; code: string | null; hint: string | null; error: string };

export function requestsRepository(db: RequestsDb) {
  return {
    /** Saves the request and queues its runner job as the signed-in person, or the database's refusal, nothing kept. */
    async make(body: RequestBody): Promise<{ ok: true; made: MadeRequest['request'] } | MakeRefusal> {
      const answer: { data: unknown; error: { message: string; code?: string; hint?: string } | null } = await db.rpc('mission_request_make', {
        p_workspace: body.workspace, p_fleet: body.fleet, p_goal: body.goal, ...(body.repo === undefined ? {} : { p_repo: body.repo }),
      });
      if (answer.error) return { ok: false, code: answer.error.code ?? null, hint: answer.error.hint ?? null, error: answer.error.message };
      return { ok: true, made: orThrow(parseRow(MadeRow, answer.data, `${WHERE}: mission_request_make`)) };
    },

    /** The request, or null when it is none or the person may not read it. */
    async read(id: string): Promise<MissionRequest['request'] | null> {
      const { data, error } = await db.from('mission_requests').select('id, repo, fleet_key, goal, requested_login, mission_number, created_at').eq('id', id).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the mission request (${error.message})`);
      if (data === null) return null;
      const row = orThrow(parseRow(RequestRow, data, `${WHERE}: mission_requests`));
      return { id: row.id, repo: row.repo, fleet: row.fleet_key, goal: row.goal, requestedBy: row.requested_login, mission: row.mission_number, createdAt: row.created_at };
    },
  };
}
export type RequestsRepository = ReturnType<typeof requestsRepository>;
