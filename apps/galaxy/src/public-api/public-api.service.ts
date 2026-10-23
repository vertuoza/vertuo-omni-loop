import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { workPath } from '../dossier/page/work';
import { currentStage } from '../stages/stage';
import { decodeCursor, encodeCursor, type CursorList } from './cursor';
import { hashApiKey, isApiKeyShaped } from './keys/secret';
import type { RunnerRefusal, KeyJob, KeySend } from '../runners/runners.contract';
import { BUG_FIX, MEGA_BUG_FIX, type ApiJob, type BugFix, type BugFixList, type ListQuery, type Prd, type PrdList, type PublicApiErrorCode, type StartBugFix, type StartMegaBugFix } from './public-api.contract';
import type { WritePermission } from './keys/github-app';
import type { DossierRow, KeyGithubApp, ListedKind, PublicApiRepository, StageRow } from './public-api.repository';

// The public API's rules (PRD 2022 s2, spec "The routes"; ADR-0095), over the repository as the service
// role. A program is its key: a secret of the key's shape, hashed, that api_key_of() answers live (not
// revoked, its maker still a member: BR-PRODUCT-64's reading of a key). Everything after reads only the
// key's own workspace (BR-PRODUCT-63's reading of a key) and, when its allow-list is not empty, only the
// dossiers whose home repository is on it, so a product PRD, which has none, shows only to a key with
// an empty list. The lists page by the cursor (./cursor.ts), newest first; a draft has no number, so it
// is never listed.
//
// A key that holds a GitHub App (PRD 2433) starts a job only where its App can run it: before anything is
// queued, the App's installation on the job's repository (a mega bug fix's plan repository) is asked of
// GitHub, and no installation, or one without write access to contents, pull_requests and issues, is a 422
// naming the repository or the permission. A key with no App queues as it always did.

/** The key a call came with, once api_key_of() answered it. */
export type ApiKeyCaller = {
  id: string;
  name: string;
  workspace: string;
  /** Its allow-list, `owner/name`; empty means every repository of the workspace. */
  repos: readonly string[];
  /** Who made it: the job's sender when a key starts one. */
  maker: string;
};

export type Answered<T> = { ok: true; value: T } | { ok: false; code: PublicApiErrorCode; message: string };

export const BAD_CURSOR = 'cursor: not a cursor of this list. Pass the `next_cursor` the last page answered, unchanged.';

/** The runners' own rules a key starts and follows a job with (PRD 2022 s4): the same service a person's Send to terminal uses. */
export type RunnersPort = {
  sendByKey: (key: { id: string; name: string; workspace: string; maker: string }, request: KeySend) => Promise<Result<KeyJob>>;
  keyJob: (workspaceId: string, jobId: string) => Promise<Result<KeyJob>>;
};
type Result<T> = { ok: true; value: T } | { ok: false; kind: RunnerRefusal; error: string };

const NO_JOB = 'No such job.';

/** The runners' refusal of a start as ours: their words, with the field they name first. */
function startRefusal(kind: RunnerRefusal, error: string): Answered<never> {
  if (kind === 'forbidden') return { ok: false, code: 'forbidden', message: error };
  if (kind === 'malformed') return { ok: false, code: 'invalid_request', message: `description: ${error}` };
  if (kind === 'missing') return { ok: false, code: 'invalid_request', message: `runner or fleet: ${error}` };
  throw new Error(`runners: ${kind} ${error}`);
}

const jobOf = (job: KeyJob): ApiJob => ({
  id: job.id, line: job.line, repo: job.repo, status: job.status, runner: job.runner, pr_url: job.prUrl, exit_code: job.exitCode,
  reason: job.reason, queued_at: job.queuedAt, claimed_at: job.claimedAt, running_at: job.runningAt, ended_at: job.endedAt,
});

/** The line a bug fix runs: the description is the skill's argument, which the runners' line check reads. */
const bugFixLine = (description: string) => `${BUG_FIX} ${description}`;

/** The line a mega bug fix runs in the plan repository: the bug, or its issue there, is the skill's argument. */
const megaBugFixLine = (description: string) => `${MEGA_BUG_FIX} ${description}`;

/** The refusal of a repository off the key's allow-list, or null when the key may start work in it. */
const offList = (key: ApiKeyCaller, repo: string): Answered<never> | null =>
  key.repos.length > 0 && !key.repos.includes(repo)
    ? { ok: false, code: 'forbidden', message: `${repo} is not on this API key’s list of repositories.` }
    : null;

const notPlan = (repo: string) =>
  `repo: ${repo} is not a plan repository of this workspace: no product names it as its plan repository. A bug of one repository starts with POST /api/v1/bug-fixes.`;

type Port = Pick<PublicApiRepository, 'keyOf' | 'dossiers' | 'products' | 'stages' | 'isPlanRepository' | 'githubAppOf'>;

/** What GitHub says of a key's App on a repository: not installed there, or installed, and the first of
 * contents, pull_requests and issues it holds no write access to (null when it holds all three). */
export type InstallationCheck = { installed: false } | { installed: true; missing: WritePermission | null };

/** Asks GitHub about the key's App on `repo` (`owner/name`). It throws when it cannot be answered: the
 * controller answers 500 and nothing is queued. */
export type CheckInstallation = (app: KeyGithubApp, repo: string) => Promise<InstallationCheck>;

const INSTALL_WITH = 'with write access to contents, pull_requests and issues';

/** The refusal of a repository the key's App is not installed on. */
const notInstalled = (app: KeyGithubApp, repo: string): Answered<never> => ({
  ok: false, code: 'github_app_not_installed',
  message: `repo: the GitHub App ${app.slug} attached to this API key is not installed on ${repo}. Install it on that repository, ${INSTALL_WITH}, then send again.`,
});

/** The refusal of an installation without write access to `permission`. */
const lacking = (app: KeyGithubApp, repo: string, permission: WritePermission): Answered<never> => ({
  ok: false, code: 'github_app_permissions',
  message: `repo: the GitHub App ${app.slug} is installed on ${repo} without write access to ${permission}. Give it write access to contents, pull_requests and issues, then send again.`,
});

const issueLink = (repo: string, number: number) => `https://github.com/${repo}/issues/${number}`;

/** The rows of one page and the cursor after it, or the refusal of a cursor that is not this list's. */
async function pageOf(
  repository: Port, key: ApiKeyCaller, kind: ListedKind, list: CursorList, query: ListQuery,
): Promise<Answered<{ rows: DossierRow[]; next: string | null }>> {
  const after = query.cursor === undefined ? null : decodeCursor(query.cursor, list);
  if (query.cursor !== undefined && after === null) return { ok: false, code: 'invalid_request', message: BAD_CURSOR };
  const read = await repository.dossiers({ workspace: key.workspace, kind, repos: key.repos, after, take: query.limit + 1 });
  const rows = read.slice(0, query.limit);
  const last = rows.at(-1);
  const next = read.length > query.limit && last ? encodeCursor({ list, createdAt: last.created_at, id: last.id }) : null;
  return { ok: true, value: { rows, next } };
}

/** The current stage of each repository PRD among `rows`, keyed `owner/name#n`. */
async function stagesOf(repository: Port, workspace: string, rows: readonly DossierRow[]): Promise<Map<string, Prd['stage']>> {
  const byRepo = new Map<string, PrdNumber[]>();
  for (const row of rows) {
    if (row.home_repo !== null && row.prd !== null) byRepo.set(row.home_repo, [...(byRepo.get(row.home_repo) ?? []), row.prd]);
  }
  const read = await Promise.all([...byRepo].map(([repo, prds]) => repository.stages(workspace, repo, prds)));
  const grouped = new Map<string, StageRow[]>();
  for (const row of read.flat()) {
    const at = `${row.repository}#${row.prd}`;
    grouped.set(at, [...(grouped.get(at) ?? []), row]);
  }
  return new Map([...grouped].map(([at, stages]) => [at, currentStage(stages)]));
}

/** `installation` is the deployment's means to ask GitHub; with none, a key's App is not checked at send. */
export function publicApiService(repository: Port, runners: RunnersPort, installation: CheckInstallation | null = null) {
  /** The refusal of a send in `repo` by a key whose App cannot run it there, or null: the key holds no App, or its App is installed with the three permissions. */
  async function appRefusal(key: ApiKeyCaller, repo: string): Promise<Answered<never> | null> {
    if (installation === null) return null;
    const app = await repository.githubAppOf(key.id);
    if (app === null) return null;
    const found = await installation(app, repo);
    if (!found.installed) return notInstalled(app, repo);
    return found.missing === null ? null : lacking(app, repo, found.missing);
  }

  /** Queues `line` in `repo` for the key, through the runners' own rules (their line check included): the
   * job is sent by the key's maker and marked as the key's. */
  async function queueAs(key: ApiKeyCaller, repo: string, line: string, where: Pick<StartBugFix, 'runner' | 'fleet'>): Promise<Answered<ApiJob>> {
    const sent = await runners.sendByKey(
      { id: key.id, name: key.name, workspace: key.workspace, maker: key.maker },
      { repo, line, runner: where.runner, fleet: where.fleet },
    );
    return sent.ok ? { ok: true, value: jobOf(sent.value) } : startRefusal(sent.kind, sent.error);
  }

  return {
    /** The live key `secret` is, or null: a secret of another shape is never looked up. */
    async keyFor(secret: string): Promise<ApiKeyCaller | null> {
      if (!isApiKeyShaped(secret)) return null;
      const row = await repository.keyOf(await hashApiKey(secret));
      return row && { id: row.key_id, name: row.name, workspace: row.workspace_id, repos: row.repos, maker: row.made_by };
    },

    /** A page of the key's PRDs, newest first; `origin` is the app's, for their pages' links. */
    async prds(key: ApiKeyCaller, query: ListQuery, origin: string): Promise<Answered<PrdList>> {
      const page = await pageOf(repository, key, 'prd', 'prds', query);
      if (!page.ok) return page;
      const { rows, next } = page.value;
      const productIds = [...new Set(rows.flatMap((row) => (row.product_id === null ? [] : [row.product_id])))];
      const [products, stages] = await Promise.all([repository.products(key.workspace, productIds), stagesOf(repository, key.workspace, rows)]);
      const productOf = new Map(products.map((p) => [p.id, { key: p.key, name: p.name }]));
      const data = rows.flatMap((row): Prd[] => {
        const product = row.product_id === null ? null : productOf.get(row.product_id) ?? null;
        const links = (issueUrl: string | null) => ({ page: `${origin}${workPath('prd', row.id)}`, issue: issueUrl });
        const common = { id: row.id, title: row.title, product, created_at: row.created_at };
        if (row.home_repo !== null && row.prd !== null) {
          return [{
            ...common, ref: String(row.prd), number: row.prd, repo: row.home_repo,
            stage: stages.get(`${row.home_repo}#${row.prd}`) ?? null, links: links(issueLink(row.home_repo, row.prd)),
          }];
        }
        if (row.product_seq === null) return [];
        const ref = product?.key ? `${product.key}-${row.product_seq}` : String(row.product_seq);
        return [{ ...common, ref, number: row.product_seq, repo: null, stage: null, links: links(null) }];
      });
      return { ok: true, value: { data, next_cursor: next } };
    },

    /** A page of the key's bug fixes, newest first. */
    async bugFixes(key: ApiKeyCaller, query: ListQuery, origin: string): Promise<Answered<BugFixList>> {
      const page = await pageOf(repository, key, 'bug', 'bug-fixes', query);
      if (!page.ok) return page;
      const data = page.value.rows.flatMap((row): BugFix[] => (row.home_repo === null || row.prd === null ? [] : [{
        id: row.id, number: row.prd, title: row.title, repo: row.home_repo, created_at: row.created_at,
        links: { page: `${origin}${workPath('bug', row.id)}`, issue: issueLink(row.home_repo, row.prd) },
      }]));
      return { ok: true, value: { data, next_cursor: page.value.next } };
    },

    /** Queues `/omni:bug-fix` for the key, through the runners' own rules (their line check included), on a
     * repository of its workspace and allow-list; the job is sent by the key's maker and marked as the key's. */
    async startBugFix(key: ApiKeyCaller, body: StartBugFix): Promise<Answered<ApiJob>> {
      const repo = body.repo.toLowerCase();
      const refused = offList(key, repo) ?? (await appRefusal(key, repo));
      return refused ?? queueAs(key, repo, bugFixLine(body.description), body);
    },

    /** Queues `/omni:mega-bug-fix` for the key in a plan repository of its workspace and allow-list, as
     * startBugFix queues its line. A repository no product names as its plan repository is refused before
     * anything is queued: the skill would only stop there, telling no one but the job's log. */
    async startMegaBugFix(key: ApiKeyCaller, body: StartMegaBugFix): Promise<Answered<ApiJob>> {
      const repo = body.repo.toLowerCase();
      const refused = offList(key, repo);
      if (refused) return refused;
      if (!(await repository.isPlanRepository(key.workspace, repo))) return { ok: false, code: 'invalid_request', message: notPlan(repo) };
      const appRefused = await appRefusal(key, repo);
      return appRefused ?? queueAs(key, repo, megaBugFixLine(body.description), body);
    },

    /** A job a key of the key's workspace queued; any other is not found. */
    async job(key: ApiKeyCaller, id: string): Promise<Answered<ApiJob>> {
      const found = await runners.keyJob(key.workspace, id);
      if (found.ok) return { ok: true, value: jobOf(found.value) };
      if (found.kind === 'missing') return { ok: false, code: 'not_found', message: NO_JOB };
      throw new Error(`runners: ${found.kind} ${found.error}`);
    },
  };
}

export type PublicApiService = ReturnType<typeof publicApiService>;
