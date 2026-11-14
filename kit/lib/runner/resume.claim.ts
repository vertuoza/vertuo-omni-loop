// What the claim of a resume carries (PRD 2809, s5): a job the app queued because its runner lost the one before it
// (`runner_jobs.resumes`) is handed to its runner with its attempt, the jobs of its chain before it, and the saves they
// left — read by `ResumeClaimSchema` on both sides: the app's runners contract re-exports it and answers `next` with it,
// the runner's `api.ts` reads it.
//
// - `attempt`: 2 or 3, the job's own (`runner_jobs.attempt`).
// - `chain`: the earlier jobs of the chain, oldest first: the job this one resumes last. A claim (a pull request's status
//   comment) that names one of them is this chain's, and this job takes it over.
// - `saves`: the saves those jobs left, oldest first (`runner_checkpoints`, PRD 2809 s4), each with its manifest: a
//   `portable` one with a signed download link of minutes to its bundle, `null` when the app could not sign one; a
//   `local` one, whose bundle stayed on the runner the manifest names.
//
// Free of Node: the app's browser-safe contract reads it.
import { z } from 'zod';
import { CheckpointManifestSchema } from './checkpoint.manifest.ts';

/** The most earlier jobs a chain holds: a chain has three attempts at most. */
const CHAIN_MAX = 2;

const JobIdSchema = z.string().min(1).max(64);

/** One save of the chain: its job, its kind and its manifest; a portable one with the link its bundle is fetched from. */
const ResumeSaveSchema = z.discriminatedUnion('kind', [
  z.object({
    job: JobIdSchema,
    kind: z.literal('portable'),
    manifest: CheckpointManifestSchema,
    /** A signed download link of minutes; `null` when the app could not sign one. */
    url: z.url({ protocol: /^https?$/ }).nullable(),
    expiresAt: z.string().nullable(),
  }),
  z.object({ job: JobIdSchema, kind: z.literal('local'), manifest: CheckpointManifestSchema }),
]);
export type ResumeSave = z.output<typeof ResumeSaveSchema>;

/** What the claim of a resume carries: its attempt, the earlier jobs of its chain, and their saves. */
export const ResumeClaimSchema = z.object({
  attempt: z.number().int().min(2).max(3),
  chain: z.array(JobIdSchema).min(1).max(CHAIN_MAX),
  saves: z.array(ResumeSaveSchema).max(CHAIN_MAX),
});
export type ResumeClaim = z.output<typeof ResumeClaimSchema>;
