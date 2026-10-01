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
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { NOT_ACTIVE_ON_PR, featureTopic, prdDirs, prdOfTopic } from '../evaluate/evaluate.mjs';
import { DEFAULT_CHECK_NAME } from '../publish/publish.mjs';
import { snapshot } from '../snapshot/snapshot.mjs';

const PER_PAGE = 100;
/** Pages read at most from a paginated list: 3,000 entries, GitHub's own cap on a compare's files. */
const MAX_PAGES = 30;

/** The compare endpoint's file statuses, in the one-letter `git diff --name-status` shape the kit reads. */
const STATUS = Object.freeze({
  added: 'A',
  removed: 'D',
  modified: 'M',
  changed: 'M',
  renamed: 'R',
  copied: 'C',
});

/**
 * The pull request's facts, read fresh: a debounced run sees the latest labels and refs.
 * @returns {Promise<{ baseRef: string, baseSha: string, headRef: string, headSha: string, labels: string[] }>}
 */
export async function readPull(octokit, { owner, repo, prNumber }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: prNumber,
  });
  return {
    baseRef: data.base.ref,
    baseSha: data.base.sha,
    headRef: data.head.ref,
    headSha: data.head.sha,
    labels: (data.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name)),
  };
}

/**
 * Snapshots the base branch's `.omni-loop/config.yml` into `dest` (a fresh temporary folder when
 * omitted) and parses it through the kit's schema.
 * @returns {Promise<{ folder: string, config: object | null, error: ConfigError | null }>}
 *   `config` null and `error` null: the base branch has no config (omni-loop is not active).
 */
export async function readBaseConfig(octokit, { owner, repo, baseSha, dest }) {
  const folder = await snapshot(octokit, { owner, repo, ref: baseSha, paths: [CONFIG_FILE], dest });
  let text;
  try {
    text = readFileSync(join(folder, CONFIG_FILE), 'utf8');
  } catch {
    return { folder, config: null, error: null };
  }
  try {
    return { folder, config: parseConfig(text, CONFIG_FILE), error: null };
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return { folder, config: null, error };
  }
}

/**
 * What the check is on this pull request, from its refs, the base branch's config and the folder
 * names under the head's delivery folder — never a blob of the head, its comments or its compare.
 * `active`: the base branch has the loop installed (PRD 359: the app posts nothing anywhere else).
 * `name`: `ci.outboxContext`, or the kit's default when the config is broken (the check still has to
 * appear, to say so). `gated`: an Omni Loop feature pull request, the only one the gate runs on
 * (issue 876); `reason` says why another is not. A broken config is gated, so its check says what is
 * wrong.
 * @returns {Promise<{ active: boolean, name: string, gated: boolean, reason: string | null }>}
 */
export async function checkTarget(octokit, { owner, repo, prNumber, headSha }) {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const folder = mkdtempSync(join(tmpdir(), 'omni-name-'));
  let read;
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
  if (feature.skip) return { active: true, name, gated: false, reason: feature.skip };
  const ref = headSha ?? pr.headSha;
  const names = [];
  for (const dir of prdDirs(config)) names.push(...(await folderNamesAt(octokit, { owner, repo, ref, dir })));
  const prd = prdOfTopic(feature.topic, names, config);
  return prd.skip ? { active: true, name, gated: false, reason: prd.skip } : { active: true, name, gated: true, reason: null };
}

/**
 * The names of the folders directly under `dir` at `ref`, walking GitHub's trees one segment at a
 * time; none when `dir` is not there. Reads no blob.
 */
export async function folderNamesAt(octokit, { owner, repo, ref, dir }) {
  let treeSha = ref;
  for (const segment of dir.split('/').filter(Boolean)) {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: treeSha });
    const entry = data.tree.find((candidate) => candidate.path === segment && candidate.type === 'tree');
    if (!entry) return [];
    treeSha = entry.sha;
  }
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', { owner, repo, tree_sha: treeSha });
  return data.tree.filter((entry) => entry.type === 'tree').map((entry) => entry.path);
}

/** Every comment on the pull request, as `{ id, body }`. */
export async function listComments(octokit, { owner, repo, prNumber }) {
  const comments = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner,
        repo,
        issue_number: prNumber,
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => data),
  );
  return comments.map(({ id, body }) => ({ id, body: body ?? '' }));
}

/**
 * The branch's changed files, `base...head`, from GitHub's compare endpoint, in the shape the kit
 * reads from `git diff --name-status` locally (`{ path, status }`).
 */
export async function changedFiles(octokit, { owner, repo, baseSha, headSha }) {
  const files = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/compare/{basehead}', {
        owner,
        repo,
        basehead: `${baseSha}...${headSha}`,
        per_page: PER_PAGE,
        page,
      })
      .then(({ data }) => data.files ?? []),
  );
  return files
    .filter((file) => STATUS[file.status])
    .map((file) => ({ path: file.filename, status: STATUS[file.status] }));
}

/**
 * Fail closed (PRD 28, decision 6), on a gated pull request only (issue 876): completes every check
 * run of this name on the head SHA that is not completed yet as `failure`, with the reason as its
 * title. With `createWhenNone` — the run failed before it could create one — it creates the check
 * already completed, so the failure is never silent. A check run this app cannot write (another
 * app's, of the same name) is left alone.
 * @returns {Promise<number[]>} the check run ids completed or created
 */
export async function completeAsFailure(octokit, { owner, repo, headSha, name, reason, createWhenNone = true }) {
  const title = `omni-loop could not evaluate: ${firstLine(reason)}`;
  return completeOpen(octokit, { owner, repo, headSha, name, conclusion: 'failure', output: { title, summary: title }, createWhenNone });
}

/**
 * Skip the check on a pull request the gate does not run on (issue 876): completes its open check
 * runs, or creates one, already `skipped`, with why as its summary. The function's first step posts
 * it before any gate read, and its failure handler posts it again, so a failed run never leaves such
 * a pull request red, missing or `in_progress`.
 * @returns {Promise<number[]>}
 */
export async function completeAsSkipped(octokit, { owner, repo, headSha, name, reason }) {
  return completeOpen(octokit, { owner, repo, headSha, name, conclusion: 'skipped', output: skippedOutput(reason), createWhenNone: true });
}

/** The output of a skipped check: the title `evaluate` gives a pull request it does not gate. */
export function skippedOutput(reason) {
  return { title: NOT_ACTIVE_ON_PR, summary: reason ?? NOT_ACTIVE_ON_PR };
}

async function completeOpen(octokit, { owner, repo, headSha, name, conclusion, output, createWhenNone }) {
  const completed_at = new Date().toISOString();

  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
    owner,
    repo,
    ref: headSha,
    check_name: name,
    per_page: PER_PAGE,
  });
  const open = (data.check_runs ?? []).filter((run) => run.status !== 'completed');

  const ids = [];
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
  if (ids.length > 0 || !createWhenNone) return ids;

  const { data: created } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    status: 'completed',
    conclusion,
    completed_at,
    output,
  });
  return [created.id];
}

async function paginate(fetchPage) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const items = await fetchPage(page);
    all.push(...items);
    if (items.length < PER_PAGE) break;
  }
  return all;
}

function firstLine(reason) {
  const text = String(reason ?? 'unknown error').trim();
  return text.split('\n')[0] || 'unknown error';
}
