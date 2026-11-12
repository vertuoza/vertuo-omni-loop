// The knowledge pack as a job of the ledger (PRD 2676 s2; PRD 2011 s11, spec "3. Knowledge is served as packs"):
// what the `knowledge-pack` function did, moved over. A job snapshots a repository's knowledge into a
// pack at one commit:
//
//   qualify  a job with a pull request: the merge (its commit and date), the config at that commit (./paths.ts
//            reads what a pack holds from it: the knowledge folder, the config and its hook files), and the files
//            the pull request changed. A pull request closed unmerged, a commit with no config or one that does
//            not parse, or a merge that touches neither the knowledge folder nor the flow config, makes no pack.
//            A job with no pull request (the hourly comparison's) goes straight to the config at its commit
//   pack     the pack's paths read at the commit, each file hashed (../knowledge-pack/files.ts), and kept through
//            knowledge_pack_put() as the service role (../knowledge-pack/store.ts); a file the pack cannot hold
//            as it is (binary, a NUL, over 1 MiB) is left out and named
//   embed    once a pack is kept in at least one workspace, and only then, the `knowledge-embed` job of the same
//            key is added (./embed.ts, PRD 2728 s4), which makes its knowledge findable by meaning
//
// The key is `<owner/name>@<commit>`, lower case, so a delivery sent twice adds one job. A job may run twice and
// is harmless: the database changes nothing for a commit it already keeps. Every GitHub call is the
// installation's budgeted client at its `background` priority (PRD 902), refused unsent while the budget is low:
// the worker reads that as `waiting`. It writes nothing on GitHub and never merges anything. The payload holds
// no token (L-GDPR-2).
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { readMerge, type RequestOctokit } from '../knowledge-harvest/github.ts';
import { packFiles } from '../knowledge-pack/files.ts';
import { changedPaths, configAt, packBytesAt } from '../knowledge-pack/github.ts';
import { packPaths, touchesPack, type PackPaths } from '../knowledge-pack/paths.ts';
import type { PackStore } from '../knowledge-pack/store.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { SnapshotBoundError } from '../snapshot/snapshot.ts';
import { embedJob } from './embed.ts';
import type { NewJob } from './ledger.ts';
import type { JobHandler, JobResult } from './worker.ts';

export const PACK_KIND = 'knowledge-pack';

/** What a pack job needs: where, and the commit. A merge also names its pull request, which qualifies it. */
const PackPayloadSchema = z.object({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  committedAt: z.string().min(1),
  prNumber: PrNumberSchema.optional(),
});
type PackPayload = z.infer<typeof PackPayloadSchema>;

/** The job a commit of `owner/repo` makes: keyed by repository and commit, the repository lower case. */
export function packJob(input: { installationId: number; owner: string; repo: string; sha: string; committedAt: string; prNumber?: PrNumber }): NewJob {
  const subject = `${input.owner}/${input.repo}`.toLowerCase();
  const { prNumber, ...rest } = input;
  return { kind: PACK_KIND, key: `${subject}@${input.sha}`, subject, payload: prNumber === undefined ? rest : { ...rest, prNumber } };
}

type Where = { owner: string; repo: string };

/** What qualifying decides: no pack, and why; or the commit, its date and what the pack holds. */
type Qualified = { skip: string } | { skip: null; sha: string; committedAt: string; paths: PackPaths };

/**
 * The handler of the `knowledge-pack` kind: `store` is the packs' database, `octokitFor` an installation's GitHub,
 * `addJob` the ledger's add, through which a kept pack adds its `knowledge-embed` job (none given, it adds none).
 */
export function packHandler({
  octokitFor,
  store,
  addJob,
  log = noteTo('knowledge-pack'),
}: {
  octokitFor: OctokitFor<RequestOctokit>;
  store: PackStore;
  addJob?: (job: NewJob) => Promise<unknown>;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const payload = payloadOf(job.payload);
    const { installationId, owner, repo } = payload;
    const repository = `${owner}/${repo}`;
    const what = labelOf(repository, payload);
    const skipped = (why: string): JobResult => {
      log(`knowledge pack: ${what} makes no pack: ${why}`);
      return { outcome: 'skipped', reason: why };
    };

    const octokit = await octokitFor(installationId);
    const qualified = payload.prNumber === undefined ? await qualifyCommit(octokit, { owner, repo }, payload) : await qualifyMerge(octokit, { owner, repo, prNumber: payload.prNumber });
    if (qualified.skip !== null) return skipped(qualified.skip);

    const packed = await pack(octokit, store, { owner, repo, repository, sha: qualified.sha, committedAt: qualified.committedAt, paths: qualified.paths });
    if ('bound' in packed) return skipped(`its knowledge is too large to pack: ${packed.bound}`);
    for (const line of packLines(what, qualified.sha, packed)) log(line);
    if (addJob && packed.packs.length > 0) await addJob(embedJob({ repository, sha: qualified.sha }));
    return { outcome: 'done' };
  };
}

/** The job's payload, or the error naming its first malformed field. */
function payloadOf(raw: unknown): PackPayload {
  const parsed = PackPayloadSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The pack job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsed.error.message}`);
}

/** What the log lines call the job: its pull request, or its commit. */
const labelOf = (repository: string, { prNumber, sha }: PackPayload) => (prNumber === undefined ? `${repository}@${sha.slice(0, 7)}` : `${repository}#${String(prNumber)}`);

/** A merge: no pack, and why; or the merge commit, its date and what the pack holds. */
async function qualifyMerge(octokit: RequestOctokit, { owner, repo, prNumber }: Where & { prNumber: PrNumber }): Promise<Qualified> {
  const merge = await readMerge(octokit, { owner, repo, prNumber });
  if (!merge.merged || !merge.sha || !merge.at) return { skip: 'it was closed, not merged' };
  const read = await configAt(octokit, { owner, repo, sha: merge.sha });
  if ('none' in read) return { skip: read.none };
  const paths = packPaths(read.config);
  if (!touchesPack(await changedPaths(octokit, { owner, repo, prNumber }), paths)) {
    return { skip: 'it touches neither the knowledge folder nor the flow config' };
  }
  return { skip: null, sha: merge.sha, committedAt: merge.at, paths };
}

/** A commit with no pull request: its config's paths, the commit and its date as the job names them. */
async function qualifyCommit(octokit: RequestOctokit, { owner, repo }: Where, { sha, committedAt }: PackPayload): Promise<Qualified> {
  const read = await configAt(octokit, { owner, repo, sha });
  if ('none' in read) return { skip: read.none };
  return { skip: null, sha, committedAt, paths: packPaths(read.config) };
}

type Packed = { bound: string } | { files: number; left: string[]; packs: { workspace: string; created: boolean; newest: boolean }[] };

/** The pack's files read at the commit, hashed and kept; or the bound the snapshot met. */
async function pack(
  octokit: RequestOctokit,
  store: PackStore,
  { owner, repo, repository, sha, committedAt, paths }: Where & { repository: string; sha: string; committedAt: string; paths: PackPaths },
): Promise<Packed> {
  let bytes: Map<string, Buffer>;
  try {
    bytes = await packBytesAt(octokit, { owner, repo, sha, paths });
  } catch (error) {
    if (error instanceof SnapshotBoundError) return { bound: error.message };
    throw error;
  }
  const { files, left } = packFiles(bytes);
  const answer = await store.put({ repository, sha, committedAt, files });
  return {
    files: files.length,
    left: left.map((file) => `${file.path}: ${file.why}`),
    packs: answer.packs.map(({ workspace, created, newest }) => ({ workspace, created, newest })),
  };
}

/** The lines a kept pack logs: each file left out, then the pack. */
function packLines(what: string, sha: string, packed: Exclude<Packed, { bound: string }>): string[] {
  const short = sha.slice(0, 7);
  const kept = packed.packs.filter((one) => one.created).length;
  return [
    ...packed.left.map((line) => `knowledge pack: ${what} left out of pack ${short}: ${line}`),
    `knowledge pack: ${what} pack ${short} of ${String(packed.files)} files, new in ${String(kept)} of ${String(packed.packs.length)} workspaces`,
  ];
}
