// The GitHub reads the `outbox-check` function needs beyond `snapshot` and `publish`: the pull
// request's facts, its comments, its changed files, what the check is on it (its name from the base
// branch's config, and whether the gate runs there), the skipped check of a pull request it does not
// gate, and the fail-closed completion its failure handler performs. Every call goes through the one
// Octokit seam the other units use, `octokit.request(route, params)`, so a test stubs one function.
//
// Nothing here runs repository code (PRD 28, decision 5): the base config is fetched through
// `snapshot` and parsed through the kit's own schema, never executed.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import type { CommentId, PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { featureTopic, NOT_ACTIVE_ON_PR, prdDirs, prdOfTopic } from '../evaluate/evaluate.ts';
import { DEFAULT_CHECK_NAME } from '../publish/publish.ts';
import { snapshot } from '../snapshot/snapshot.ts';
import { PER_PAGE, paginate } from '../retro/github.ts';
import {
  CheckRunsSchema,
  CommentsPageSchema,
  ComparePageSchema,
  CreatedSchema,
  firstLine,
  labelName,
  PullSchema,
  TreeSchema,
  type GitHubClient,
  type Repo,
} from './github-schema.ts';

export type { GitHubClient, Repo } from './github-schema.ts';

/** The compare endpoint's file statuses, in the one-letter `git diff --name-status` shape the kit reads. */
const STATUS: Readonly<Record<string, string>> = Object.freeze({
  added: 'A',
  removed: 'D',
  modified: 'M',
  changed: 'M',
  renamed: 'R',
  copied: 'C',
});

/** A pull request's facts, as the checks read them. */
export type PullFacts = { baseRef: string; baseSha: string; headRef: string; headSha: string; labels: string[] };

/** A changed path, in the shape the kit reads from `git diff --name-status`. */
export type Change = { path: string; status: string };

/** A comment on a pull request. */
export type Comment = { id: CommentId; body: string };

/** The pull request's facts, read fresh: a debounced run sees the latest labels and refs. */
export async function readPull(octokit: GitHubClient, { owner, repo, prNumber }: Repo & { prNumber: PrNumber }): Promise<PullFacts> {
  const { data: answer } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: prNumber,
  });
  const data = PullSchema.parse(answer);
  return {
    baseRef: data.base.ref,
    baseSha: data.base.sha,
    headRef: data.head.ref,
    headSha: data.head.sha,
    labels: (data.labels ?? []).map(labelName).filter((name) => name !== undefined),
  };
}

/** The base branch's config as `readBaseConfig` read it. */
export type BaseConfig = { folder: string; config: Config | null; error: ConfigError | null };

/**
 * Snapshots the base branch's `.omni-loop/config.yml` into `dest` (a fresh temporary folder when
 * omitted) and parses it through the kit's schema. `config` null and `error` null: the base branch has
 * no config (omni-loop is not active). With `ignoreUnknownKeys`, a key this kit does not know is left
 * out rather than refused (the retro, #1151); the checks keep refusing it, to say the config is wrong.
 */
export async function readBaseConfig(
  octokit: GitHubClient,
  { owner, repo, baseSha, dest, ignoreUnknownKeys = false }: Repo & { baseSha: string; dest?: string; ignoreUnknownKeys?: boolean },
): Promise<BaseConfig> {
  const folder = await snapshot(octokit, { owner, repo, ref: baseSha, paths: [CONFIG_FILE], dest });
  let text;
  try {
    text = readFileSync(join(folder, CONFIG_FILE), 'utf8');
  } catch {
    return { folder, config: null, error: null };
  }
  try {
    return { folder, config: parseConfig(text, CONFIG_FILE, { ignoreUnknownKeys }), error: null };
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return { folder, config: null, error };
  }
}

/**
/** What the check is on a pull request: see `checkTarget`. */
export type CheckTarget = { active: boolean; name: string; gated: boolean; reason: string | null };

/**
 * What the check is on this pull request, from its refs, the base branch's config and the folder
 * names under the head's delivery folder — never a blob of the head, its comments or its compare.
 * `active`: the base branch has the loop installed (PRD 359: the app posts nothing anywhere else).
 * `name`: `ci.outboxContext`, or the kit's default when the config is broken (the check still has to
 * appear, to say so). `gated`: an Omni Loop feature pull request, the only one the gate runs on
 * (issue 876); `reason` says why another is not. A broken config is gated, so its check says what is
 * wrong.
 */
export async function checkTarget(
  octokit: GitHubClient,
  { owner, repo, prNumber, headSha }: Repo & { prNumber: PrNumber; headSha?: string | undefined },
): Promise<CheckTarget> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const folder = mkdtempSync(join(tmpdir(), 'omni-name-'));
  let read: BaseConfig;
  try {
    read = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha, dest: folder });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  const { config, error } = read;
  if (!config && !error) return { active: false, name: DEFAULT_CHECK_NAME, gated: false, reason: null };
  if (!config) return { active: true, name: DEFAULT_CHECK_NAME, gated: true, reason: null };

  const name = config.ci.outboxContext;
  const feature = featureTopic(pr, config);
  if ('skip' in feature) return { active: true, name, gated: false, reason: feature.skip };
  const ref = headSha ?? pr.headSha;
  const names: string[] = [];
  for (const dir of prdDirs(config)) names.push(...(await folderNamesAt(octokit, { owner, repo, ref, dir })));
  const prd = prdOfTopic(feature.topic, names, config);
  return 'skip' in prd ? { active: true, name, gated: false, reason: prd.skip } : { active: true, name, gated: true, reason: null };
}

/**
 * The names of the folders directly under `dir` at `ref`, walking GitHub's trees one segment at a
 * time; none when `dir` is not there. Reads no blob.
 */
async function folderNamesAt(
  octokit: GitHubClient,
  { owner, repo, ref, dir }: Repo & { ref: string; dir: string },
): Promise<string[]> {
  const treeAt = async (treeSha: string) =>
    TreeSchema.parse((await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: treeSha })).data).tree;
  let treeSha = ref;
  for (const segment of dir.split('/').filter(Boolean)) {
    const entry = (await treeAt(treeSha)).find((candidate) => candidate.path === segment && candidate.type === 'tree');
    if (!entry) return [];
    treeSha = entry.sha;
  }
  return (await treeAt(treeSha)).filter((entry) => entry.type === 'tree').map((entry) => entry.path);
}

/** Every comment on the pull request, as `{ id, body }`. */
export async function listComments(octokit: GitHubClient, { owner, repo, prNumber }: Repo & { prNumber: PrNumber }): Promise<Comment[]> {
  const comments = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => CommentsPageSchema.parse(data)),
  );
  return comments.map(({ id, body }) => ({ id, body: body ?? '' }));
}

/**
 * The branch's changed files, `base...head`, from GitHub's compare endpoint, in the shape the kit
 * reads from `git diff --name-status` locally (`{ path, status }`).
 */
export async function changedFiles(
  octokit: GitHubClient,
  { owner, repo, baseSha, headSha }: Repo & { baseSha: string; headSha: string },
): Promise<Change[]> {
  const files = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/compare/{basehead}', {
        owner,
        repo,
        basehead: `${baseSha}...${headSha}`,
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => ComparePageSchema.parse(data).files ?? []),
  );
  return files.flatMap((file) => {
    const status = STATUS[file.status];
    return status ? [{ path: file.filename, status }] : [];
  });
}

/**
/**
 * Fail closed (PRD 28, decision 6), on a gated pull request only (issue 876): completes every check
 * run of this name on the head SHA that is not completed yet as `failure`, with the reason as its
 * title. When there is none — the run failed before it could create one — it creates the check
 * already completed, so the failure is never silent, unless `create` is false. A check run this app
 * cannot write (another app's, of the same name) is left alone. `externalId`: the one a created check
 * run carries (the inbox check's).
 * @returns the check run ids completed or created
 */
export async function completeAsFailure(
  octokit: GitHubClient,
  {
    owner,
    repo,
    headSha,
    name,
    reason,
    externalId,
    create = true,
  }: Repo & { headSha: string; name: string; reason: unknown; externalId?: string; create?: boolean },
): Promise<number[]> {
  const title = `omni-loop could not evaluate: ${firstLine(reason)}`;
  const output = { title, summary: title };
  return completeOpen(octokit, { owner, repo, headSha, name, conclusion: 'failure', output, create, externalId });
}

/**
 * Skip the check on a pull request the gate does not run on (issue 876): completes its open check
 * runs, or creates one, already `skipped`, with why as its summary. The function's first step posts
 * it before any gate read, and its failure handler posts it again, so a failed run never leaves such
 * a pull request red, missing or `in_progress`.
 * @returns {Promise<number[]>}
 */
export async function completeAsSkipped(
  octokit: GitHubClient,
  { owner, repo, headSha, name, reason }: Repo & { headSha: string; name: string; reason: string | null },
): Promise<number[]> {
  return completeOpen(octokit, { owner, repo, headSha, name, conclusion: 'skipped', output: skippedOutput(reason), create: true });
}

/** The output of a skipped check: the title `evaluate` gives a pull request it does not gate. */
function skippedOutput(reason: string | null | undefined): { title: string; summary: string } {
  return { title: NOT_ACTIVE_ON_PR, summary: reason ?? NOT_ACTIVE_ON_PR };
}

/** Completes the open check runs of this name as `conclusion`, or creates one completed unless `create` is false. */
async function completeOpen(
  octokit: GitHubClient,
  {
    owner,
    repo,
    headSha,
    name,
    conclusion,
    output,
    create,
    externalId,
  }: Repo & {
    headSha: string;
    name: string;
    conclusion: 'failure' | 'skipped';
    output: { title: string; summary: string };
    create: boolean;
    externalId?: string | undefined;
  },
): Promise<number[]> {
  const completed_at = new Date().toISOString();

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
    owner,
    repo,
    ref: headSha,
    check_name: name,
    per_page: PER_PAGE,
  });
  const open = (CheckRunsSchema.parse(data).check_runs ?? []).filter((run) => run.status !== 'completed');

  const ids: number[] = [];
  for (const run of open) {
    try {
      await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
        owner,
        repo,
        check_run_id: run.id,
        status: 'completed',
        conclusion,
        completed_at,
        output,
      });
      ids.push(run.id);
    } catch {
      // Not this app's check run; GitHub refuses the write. Nothing to complete here.
    }
  }
  if (ids.length > 0 || !create) return ids;

  const { data: created } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    ...(externalId === undefined ? {} : { external_id: externalId }),
    status: 'completed',
    conclusion,
    completed_at,
    output,
  });
  return [CreatedSchema.parse(created).id];
}
