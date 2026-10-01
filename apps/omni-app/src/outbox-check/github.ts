// @ts-nocheck
// The GitHub reads the `outbox-check` function needs beyond `snapshot` and `publish`: the pull
// request's facts, its comments, its changed files, the check's name from the base branch's config,
// and the fail-closed completion its failure handler performs. Every call goes through the one
// Octokit seam the other units use, `octokit.request(route, params)`, so a test stubs one function.
//
// Nothing here runs repository code (PRD 28, decision 5): the base config is fetched through
// `snapshot` and parsed through the kit's own schema, never executed.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { DEFAULT_CHECK_NAME } from '../publish/publish.ts';
import { snapshot } from '../snapshot/snapshot.ts';

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
 * Whether the base branch has the loop installed, and the check's name there: `ci.outboxContext`
 * from its config, or the kit's default when that config is broken (the check still has to appear,
 * to say so). A base branch with no config at all is not active: the app posts nothing there
 * (PRD 359), since a public app is installed on repositories that never asked for the loop.
 * @returns {Promise<{ active: boolean, name: string }>}
 */
export async function checkTarget(octokit, { owner, repo, baseSha }) {
  const folder = mkdtempSync(join(tmpdir(), 'omni-name-'));
  try {
    const { config, error } = await readBaseConfig(octokit, { owner, repo, baseSha, dest: folder });
    return { active: Boolean(config || error), name: config?.ci.outboxContext ?? DEFAULT_CHECK_NAME };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
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
 * Fail closed (PRD 28, decision 6): completes every check run of this name on the head SHA that is
 * not completed yet as `failure`, with the reason as its title. When there is none — the run failed
 * before it could create one — it creates the check already completed, so the failure is never
 * silent. A check run this app cannot write (another app's, of the same name) is left alone.
 * @returns {Promise<number[]>} the check run ids completed or created
 */
export async function completeAsFailure(octokit, { owner, repo, headSha, name, reason }) {
  const title = `omni-loop could not evaluate: ${firstLine(reason)}`;
  const output = { title, summary: title };
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
        conclusion: 'failure',
        completed_at,
        output,
      });
      ids.push(run.id);
    } catch {
      // Not this app's check run; GitHub refuses the write. Nothing to complete here.
    }
  }
  if (ids.length > 0) return ids;

  const { data: created } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    status: 'completed',
    conclusion: 'failure',
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
