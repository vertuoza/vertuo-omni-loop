// `knowledge-pack`: the Inngest function that snapshots a repository's knowledge into a pack when a merge
// touches it (PRD 2011 s11, spec "3. Knowledge is served as packs"). It runs on the event the webhook
// already sends for every pull request merged into the default branch (`HARVEST_EVENT`, beside the
// knowledge harvest, which only takes feature PRs): a knowledge PR's merge, a hook's edit or a config
// change all make a pack, whatever branch they came from.
//
//   step "held"     whether any product holds the repository; none: nothing is read and nothing kept,
//                   so a repository outside every product spends nothing of the installation's budget
//   step "qualify"  the merge (its commit and date), the config at that commit (./paths.ts reads what a
//                   pack holds from it: the knowledge folder, the config and its hook files), and the
//                   files the pull request changed. A pull request closed unmerged, a commit with no
//                   config or one that does not parse, or a merge that touches neither the knowledge
//                   folder nor the flow config, makes no pack
//   step "pack"     the pack's paths read at the merge commit, each file hashed (./files.ts), and kept
//                   through knowledge_pack_put() as the service role (./store.ts); a file the pack
//                   cannot hold as it is (binary, a NUL, over 1 MiB) is left out and named
//
// It runs at background priority, in the installation's budget: Inngest starts it after the checks a
// person waits on (`priority`), and every GitHub call is the installation's budgeted client at its
// `background` priority (PRD 902), refused unsent while the budget is low, which fails the step for
// Inngest to retry later. One run at a time per repository. A replay keeps nothing twice: the database
// changes nothing for a commit it already keeps. It writes nothing on GitHub and never merges anything.
import { type Inngest, NonRetriableError } from 'inngest';
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { HARVEST_EVENT } from '../inngest-client.ts';
import { readMerge, type RequestOctokit } from '../knowledge-harvest/github.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { noteTo } from '../run-log/run-log.ts';
import { savedStep } from '../saved-step.ts';
import { SnapshotBoundError } from '../snapshot/snapshot.ts';
import { packFiles } from './files.ts';
import { changedPaths, configAt, packBytesAt } from './github.ts';
import { packPaths, touchesPack, type PackPaths } from './paths.ts';
import type { PackStore } from './store.ts';

export const KNOWLEDGE_PACK_FUNCTION_ID = 'knowledge-pack';

/** One run at a time per repository, so two merges never decide the newest pack at once. */
export const CONCURRENCY = Object.freeze({ key: 'event.data.repository', limit: 1 });

/** Background: Inngest's lowest priority, so a run waits behind the checks a person waits on. */
export const PRIORITY = Object.freeze({ run: '-600' });

/** The merge event, as this function reads it. */
const PackEventSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  prNumber: PrNumberSchema,
});

const PathsSchema = z.object({ folders: z.array(z.string()), files: z.array(z.string()) });

/** What "qualify" decides: no pack, and why; or the commit, its date and what the pack holds. */
const QualifiedSchema = z.union([
  z.object({ skip: z.string() }),
  z.object({ skip: z.null(), sha: z.string().regex(/^[0-9a-f]{40}$/), committedAt: z.string(), paths: PathsSchema }),
]);
type Qualified = z.infer<typeof QualifiedSchema>;

/** What "pack" did: the pack kept in each workspace, or the bound the snapshot met. */
const PackedSchema = z.union([
  z.object({ bound: z.string() }),
  z.object({
    files: z.number().int().nonnegative(),
    left: z.array(z.string()),
    packs: z.array(z.object({ workspace: z.string(), created: z.boolean(), newest: z.boolean() })),
  }),
]);
type Packed = z.infer<typeof PackedSchema>;

export function createKnowledgePack({
  client,
  octokitFor,
  store,
  log = noteTo('knowledge-pack'),
}: {
  client: Inngest.Any;
  octokitFor: OctokitFor<RequestOctokit>;
  /** The packs' database; null when the App cannot reach the server here, which keeps nothing. */
  store: PackStore | null;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    {
      id: KNOWLEDGE_PACK_FUNCTION_ID,
      name: 'omni-loop · knowledge pack',
      triggers: [{ event: HARVEST_EVENT }],
      concurrency: CONCURRENCY,
      priority: PRIORITY,
      retries: 3,
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, repository, prNumber } = eventOf(event.data);
      const pull = `${repository}#${String(prNumber)}`;
      const skipped = (why: string) => {
        log(`knowledge pack: ${pull} makes no pack: ${why}`);
        return { pull, skipped: why };
      };
      if (!store) return skipped('the App cannot reach the server here');

      const held = await savedStep(step, 'held', z.boolean(), () => store.held(repository));
      if (!held) return skipped(`no product holds ${repository}`);

      const qualified = await savedStep(step, 'qualify', QualifiedSchema, async () => qualify(await octokitFor(installationId), { owner, repo, prNumber }));
      if (qualified.skip !== null) return skipped(qualified.skip);
      const { sha, committedAt, paths } = qualified;

      const packed = await savedStep(step, 'pack', PackedSchema, async () =>
        pack(await octokitFor(installationId), store, { owner, repo, repository, sha, committedAt, paths }));
      if ('bound' in packed) return skipped(`its knowledge is too large to pack: ${packed.bound}`);

      for (const line of packLines(pull, sha, packed)) log(line);
      return { pull, sha, committedAt, files: packed.files, left: packed.left, packs: packed.packs };
    },
  );
}

type Where = { owner: string; repo: string };

/** The merge event's data, or the non-retriable error naming its first malformed field. */
function eventOf(data: unknown): z.infer<typeof PackEventSchema> {
  const parsed = PackEventSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new NonRetriableError(`The merge event is malformed: ${issue?.path.join('.') || '(event)'}: ${issue?.message ?? parsed.error.message}`);
}

/** The step "qualify": no pack, and why; or the merge commit, its date and what the pack holds. */
async function qualify(octokit: RequestOctokit, { owner, repo, prNumber }: Where & { prNumber: PrNumber }): Promise<Qualified> {
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

/** The step "pack": the pack's files read at the commit, hashed and kept; or the bound the snapshot met. */
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
function packLines(pull: string, sha: string, packed: Exclude<Packed, { bound: string }>): string[] {
  const short = sha.slice(0, 7);
  const kept = packed.packs.filter((one) => one.created).length;
  return [
    ...packed.left.map((line) => `knowledge pack: ${pull} left out of pack ${short}: ${line}`),
    `knowledge pack: ${pull} pack ${short} of ${String(packed.files)} files, new in ${String(kept)} of ${String(packed.packs.length)} workspaces`,
  ];
}
