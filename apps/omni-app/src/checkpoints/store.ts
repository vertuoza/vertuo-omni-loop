// The `checkpoints-forget` job's database and bucket (PRD 2809 s6), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`): the App has no person's session.
//
//   kept        the saves whose bundle is still in the bucket (`runner_checkpoints`, kind `portable`, no
//               `deleted_at`), the oldest first, one page after another: nothing but ids, paths and dates, never a
//               manifest
//   ended       of a set of jobs, those whose chain of attempts has ended: following `runner_jobs.resumes` forward
//               from each to the chain's last attempt, which is over (done, failed or cancelled). A job a resume
//               was queued for is not the last, so a chain still being resumed never ends
//   remove      deletes bundles from the private `runner-checkpoints` bucket
//   stamp       sets `deleted_at` of the saves whose bundle was deleted
//
// Throws when the database or the bucket refuses or answers out of shape; never a path in the message.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** The private bucket a runner's bundles live in (supabase/migrations/20270121103000_runner_checkpoints.sql). */
const CHECKPOINT_BUCKET = 'runner-checkpoints';

/** A save whose bundle is in the bucket: its row, its job, the bundle's path and when it was made and must go. */
export type Kept = { id: string; jobId: string; path: string; createdAt: string; keepUntil: string };

export type CheckpointStore = {
  /** A page of the saves still in the bucket, the oldest first, from `offset`. */
  kept: (offset: number, limit: number) => Promise<Kept[]>;
  /** Of `jobIds`, those whose chain of attempts has ended. */
  ended: (jobIds: readonly string[]) => Promise<Set<string>>;
  remove: (paths: readonly string[]) => Promise<void>;
  stamp: (ids: readonly string[], at: Date) => Promise<void>;
};

export const KeptRowSchema = z.object({
  id: z.string().min(1),
  job_id: z.string().min(1),
  storage_path: z.string().min(1),
  created_at: z.string().min(1),
  keep_until: z.string().min(1),
});
const ResumeRowSchema = z.object({ id: z.string().min(1), resumes: z.string().min(1) });
const StatusRowSchema = z.object({ id: z.string().min(1), status: z.string().min(1) });

/** The statuses of a job that is over. */
const OVER = ['done', 'failed', 'cancelled'];
/** A chain has 3 attempts at most: two resumes follow its first job. */
const MAX_RESUMES = 2;

/** A refusal thrown, naming the database's message and code; never a path. */
function refused(error: { message: string; code?: string }): Error {
  return new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

/** The store, as the service role on `connection`. */
export function checkpointStore(connection: Connection): CheckpointStore {
  const db = serviceDb(connection);
  return {
    kept: async (offset, limit) => {
      const rows = rowsOf(
        KeptRowSchema,
        await db
          .from('runner_checkpoints')
          .select('id, job_id, storage_path, created_at, keep_until')
          .eq('kind', 'portable')
          .is('deleted_at', null)
          .not('storage_path', 'is', null)
          .order('created_at')
          .order('id')
          .range(offset, offset + limit - 1),
      );
      return rows.map((row) => ({ id: row.id, jobId: row.job_id, path: row.storage_path, createdAt: row.created_at, keepUntil: row.keep_until }));
    },

    ended: async (jobIds) => {
      // Each job's last attempt so far, moved forward along the resumes until none is left.
      const last = new Map(jobIds.map((id) => [id, id]));
      for (let step = 0; step < MAX_RESUMES; step += 1) {
        const tips = [...new Set(last.values())];
        if (tips.length === 0) break;
        const next = rowsOf(ResumeRowSchema, await db.from('runner_jobs').select('id, resumes').in('resumes', tips));
        if (next.length === 0) break;
        const resumeOf = new Map(next.map((row) => [row.resumes, row.id]));
        for (const [id, tip] of last) last.set(id, resumeOf.get(tip) ?? tip);
      }
      const tips = [...new Set(last.values())];
      if (tips.length === 0) return new Set();
      const over = new Set(
        rowsOf(StatusRowSchema, await db.from('runner_jobs').select('id, status').in('id', tips))
          .filter((row) => OVER.includes(row.status))
          .map((row) => row.id),
      );
      return new Set(jobIds.filter((id) => over.has(last.get(id) ?? id)));
    },

    remove: async (paths) => {
      if (paths.length === 0) return;
      const { error } = await db.storage.from(CHECKPOINT_BUCKET).remove([...paths]);
      if (error) throw new Error(`the bucket refused: ${error.message}`);
    },

    stamp: async (ids, at) => {
      if (ids.length === 0) return;
      const { error } = await db.from('runner_checkpoints').update({ deleted_at: at.toISOString() }).in('id', [...ids]);
      if (error) throw refused(error);
    },
  };
}
