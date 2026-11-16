import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';
import type { LimitedJob, QueuedJob, WaitFacts } from './limit-wait';

// What the Operation room and the Missions tab read to say a PRD waits (PRD 2949 s5), on the signed-in person's own client: the
// queued jobs of the missions, the jobs they resume (their limit and the account in their parts) and each mission's
// supervisor words. A failed read throws. The rules live in ./limit-wait.ts.

export type LimitWaitDb = Pick<SupabaseClient, 'from'>;

const WHERE = 'missions/limit-wait.repository';

const QueuedSchema = z.object({ id: z.string(), mission_id: z.string(), mission_key: z.string().nullable(), resumes: z.string().nullable(), queued_at: z.string() });
const LimitedSchema = z.object({
  id: z.string(),
  limited_until: z.string().nullable().catch(null),
  parts: z.array(z.looseObject({ account: z.string().optional(), guessed: z.boolean().optional(), ended: z.string().nullable().optional() })).nullable().catch(null),
});
const MissionSchema = z.object({ id: z.string(), waiting_on: z.string().nullable() });

export function limitWaitRepository(db: LimitWaitDb) {
  return {
    /** The facts the waits of these missions are read from. */
    async facts(missions: readonly string[]): Promise<WaitFacts> {
      if (missions.length === 0) return { queued: [], limited: [], waitingOn: new Map() };
      const ids = [...missions];
      const waiting = await db.from('missions').select('id, waiting_on').in('id', ids);
      if (waiting.error) throw new Error(`Supabase: could not read what the missions wait on (${waiting.error.message})`);
      const queued = await db.from('runner_jobs').select('id, mission_id, mission_key, resumes, queued_at').in('mission_id', ids).eq('status', 'queued');
      if (queued.error) throw new Error(`Supabase: could not read the missions' queued jobs (${queued.error.message})`);
      const jobs: QueuedJob[] = orThrow(parseRows(QueuedSchema, queued.data, `${WHERE}: runner_jobs`)).map((row) => ({ id: row.id, mission: row.mission_id, key: row.mission_key, resumes: row.resumes, queuedAt: row.queued_at }));
      const before = jobs.flatMap((job) => (job.resumes === null ? [] : [job.resumes]));
      let limited: LimitedJob[] = [];
      if (before.length > 0) {
        const ended = await db.from('runner_jobs').select('id, limited_until, parts').in('id', before);
        if (ended.error) throw new Error(`Supabase: could not read the jobs that met a limit (${ended.error.message})`);
        limited = orThrow(parseRows(LimitedSchema, ended.data, `${WHERE}: runner_jobs`)).map((row) => {
          const last = row.parts?.at(-1);
          const ran = row.parts?.findLast((part) => part.ended === 'limit') ?? last;
          return { id: row.id, limitedUntil: row.limited_until, account: ran?.account ?? null, guessed: last?.guessed === true };
        });
      }
      const words = new Map(orThrow(parseRows(MissionSchema, waiting.data, `${WHERE}: missions`)).map((row) => [row.id, row.waiting_on]));
      return { queued: jobs, limited, waitingOn: words };
    },
  };
}
