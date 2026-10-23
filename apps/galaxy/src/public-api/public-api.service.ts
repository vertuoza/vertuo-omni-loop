import { PrNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { workPath } from '../dossier/page/work';
import { currentStage } from '../stages/stage';
import { decodeCursor, decodeLinesCursor, encodeCursor, encodeLinesCursor, type CursorList } from './cursor';
import { hashApiKey, isApiKeyShaped } from './keys/secret';
import type { RunnerRefusal, JobQuestions, KeyCloser, KeyJob, KeySend } from '../runners/runners.contract';
import { BUG_FIX, MEGA_BUG_FIX, type AnswerJob, type ApiJob, type ApiQuestions, type BugFix, type BugFixList, type CancelJob, type DismissJob, type JobLineList, type ListQuery, type Prd, type PrdList, type PublicApiErrorCode, type RelaunchJob, type StartBugFix, type StartMegaBugFix } from './public-api.contract';
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

/** The runners' own rules a key starts, follows, answers, cancels and relaunches a job with (PRD 2022 s4, PRD 2425 s6 and s7): the
 * same service a person's Send to terminal and Runners page use. */
export type RunnersPort = {
  sendByKey: (key: { id: string; name: string; workspace: string; maker: string }, request: KeySend) => Promise<Result<KeyJob>>;
  keyJob: (workspaceId: string, jobId: string) => Promise<Result<KeyJob>>;
  questionsByKey: (workspaceId: string, jobId: string) => Promise<Result<JobQuestions>>;
  answerByKey: (key: KeyCloser, jobId: string, answers: Record<string, string>) => Promise<Result<KeyJob>>;
  dismissByKey: (key: KeyCloser, jobId: string) => Promise<Result<KeyJob>>;
  cancelByKey: (key: KeyCloser, jobId: string) => Promise<Result<KeyJob>>;
  relaunchByKey: (key: KeyCloser, jobId: string) => Promise<Result<KeyJob>>;
  /** Whether a link may be pinged (PRD 2425 s8): null when it may, why not otherwise, in words. */
  notifyCheck: (url: string) => Promise<string | null>;
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

/** What a refusal to read, answer, dismiss, cancel or relaunch a job is called here (BR-PRODUCT-12 for the second close: a conflict). */
const CLOSE_REFUSALS: Partial<Record<RunnerRefusal, PublicApiErrorCode>> = {
  missing: 'not_found', conflict: 'conflict', forbidden: 'forbidden', malformed: 'invalid_request',
};

/** The runners' refusal of a read, an answer, a dismissal or a cancel as ours: their words, with `answers:` first for answers that do not fit the questions. */
function closeRefusal(kind: RunnerRefusal, error: string): Answered<never> {
  const code = CLOSE_REFUSALS[kind];
  if (code === undefined) throw new Error(`runners: ${kind} ${error}`);
  return { ok: false, code, message: kind === 'malformed' ? `answers: ${error}` : error };
}

/** The runners' refusal of a relaunch as ours, the job being known to exist by then: the runner it named being gone is a conflict, not a
 * job that is not found, and a line they no longer take is refused in their words, no field named (a relaunch sends none). */
function relaunchRefusal(kind: RunnerRefusal, error: string): Answered<never> {
  if (kind === 'missing') return { ok: false, code: 'conflict', message: error };
  if (kind === 'malformed') return { ok: false, code: 'invalid_request', message: error };
  return closeRefusal(kind, error);
}

/** Who a key acts as when it closes, cancels or relaunches a job: itself, and whom it says it acts for. */
const closerOf = (key: ApiKeyCaller, body: { acting_for?: string | undefined }): KeyCloser => ({ id: key.id, workspace: key.workspace, actingFor: body.acting_for ?? null });

/** Who closed a round, as the API says it: the key by its name with whom it acted for, or the person by login (null when they have none);
 * null while it is open, and for a round whose key was deleted since, which leaves no closer. */
function closedByOf(asked: JobQuestions): ApiQuestions['closed_by'] {
  if (typeof asked.byKey === 'string') return { key: asked.byKey, acting_for: asked.actingFor ?? null };
  return asked.by === null ? null : { login: asked.byLogin };
}

const questionsOf = (asked: JobQuestions): ApiQuestions => ({
  lead: asked.lead,
  questions: asked.questions.map((q) => ({
    question: q.question, header: q.header, multi_select: q.multiSelect, options: q.options.map(({ label, description }) => ({ label, description })),
  })),
  state: asked.state, answers: asked.answers, closed_by: closedByOf(asked),
});

/** A bug fix's words in its log, as the API says them (PRD 2425): an underscore for each hyphen. */
const OUTCOME_WORDS: Record<NonNullable<KeyJob['outcome']>, NonNullable<ApiJob['outcome']>> = {
  'pr-opened': 'pr_opened', 'already-fixed': 'already_fixed', 'need-human': 'need_human', 'needs-brainstorm': 'needs_brainstorm',
  'not-a-bug': 'not_a_bug', stuck: 'stuck', blocked: 'blocked',
};

/** What the runners stored for a pull request: `https://github.com/<owner>/<name>/pull/<number>`, as the report's check let it in. */
const PULL_REQUEST = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)$/;

/** A pull request a job opened, as the API names it: its link, its repository in lower case (as an allow-list names one) and its
 * number. A link that is not one, which no report stores, is left out rather than failing the whole read. */
function pullRequestOf(url: string): ApiJob['prs'] {
  const [, repo = '', digits = ''] = PULL_REQUEST.exec(url) ?? [];
  const number = PrNumberSchema.safeParse(Number(digits));
  return number.success ? [{ url, repo: repo.toLowerCase(), number: number.data }] : [];
}

const jobOf = (job: KeyJob): ApiJob => ({
  id: job.id, line: job.line, repo: job.repo, status: job.status, runner: job.runner, pr_url: job.prUrl, exit_code: job.exitCode,
  reason: job.reason, queued_at: job.queuedAt, claimed_at: job.claimedAt, running_at: job.runningAt, ended_at: job.endedAt,
  outcome: job.outcome === null ? null : OUTCOME_WORDS[job.outcome], fixed_by: job.fixedBy, prs: job.prs.flatMap(pullRequestOf),
  questions: job.questions === null ? null : { state: job.questions },
  continues: job.continues, continued_by: job.continuedBy, acting_for: job.actingFor,
  cancelled_by: job.cancelledBy === null ? null : { key: job.cancelledBy.key, acting_for: job.cancelledBy.actingFor },
  log_tail: job.logTail,
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

type Port = Pick<PublicApiRepository, 'keyOf' | 'dossiers' | 'products' | 'stages' | 'isPlanRepository' | 'jobLines' | 'githubAppOf'>;

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
   * job is sent by the key's maker and marked as the key's. A start that names a link to ping (PRD 2425 s8) has it checked first: a
   * link that may not be pinged (not https, carrying a login, a host that is not public) is a 422 and nothing is queued. */
  async function queueAs(
    key: ApiKeyCaller, repo: string, line: string, where: Pick<StartBugFix, 'runner' | 'fleet' | 'acting_for' | 'notify_url'>,
  ): Promise<Answered<ApiJob>> {
    const unpingable = where.notify_url === undefined ? null : await runners.notifyCheck(where.notify_url);
    if (unpingable !== null) return { ok: false, code: 'invalid_request', message: `notify_url: ${unpingable}` };
    const sent = await runners.sendByKey(
      { id: key.id, name: key.name, workspace: key.workspace, maker: key.maker },
      { repo, line, runner: where.runner, fleet: where.fleet, actingFor: where.acting_for, notifyUrl: where.notify_url },
    );
    return sent.ok ? { ok: true, value: jobOf(sent.value) } : startRefusal(sent.kind, sent.error);
  }

  /** The job `id` as `key` reads it: a job of a key of its workspace, on a repository of its allow-list. */
  async function readJob(key: ApiKeyCaller, id: string): Promise<Answered<ApiJob>> {
    const found = await runners.keyJob(key.workspace, id);
    if (found.ok) return offList(key, found.value.repo) ?? { ok: true, value: jobOf(found.value) };
    if (found.kind === 'missing') return { ok: false, code: 'not_found', message: NO_JOB };
    throw new Error(`runners: ${found.kind} ${found.error}`);
  }

  /** What the runners answer to `act` on the job `id`, as the job: only once `key` may read it (so a job it may not is refused as a read
   * refuses it, before anything runs), and a refusal as `refuse` says it. */
  async function actOnJob(
    key: ApiKeyCaller, id: string, act: () => Promise<Result<KeyJob>>, refuse: (kind: RunnerRefusal, error: string) => Answered<never> = closeRefusal,
  ): Promise<Answered<ApiJob>> {
    const found = await readJob(key, id);
    if (!found.ok) return found;
    const done = await act();
    return done.ok ? { ok: true, value: jobOf(done.value) } : refuse(done.kind, done.error);
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

    /** A job a key of the key's workspace queued, whichever key it was, with what it did, on a repository of this key's
     * allow-list (PRD 2425); a person's job, another workspace's and a job that does not exist are not found, whatever
     * the list, so a key learns nothing of them, and one off its list is refused only once the job is known to be its
     * workspace's. */
    job: readJob,

    /** A page of the lines of a job a key may read, as `job` finds it (a person's job, another workspace's and a
     * job that does not exist are not found, one off the key's list is refused, and neither reads a line), oldest
     * first, by the job's own sequence numbers (PRD 2425 s4). A cursor that is not this job's lines is refused only
     * once the job is known to be the key's to read, so it tells a key nothing of a job it may not. A job past the
     * workspace's retention of its 50 newest ended jobs holds no line: an empty page, its `log_tail` still on the job. */
    async jobLines(key: ApiKeyCaller, id: string, query: ListQuery): Promise<Answered<JobLineList>> {
      const found = await readJob(key, id);
      if (!found.ok) return found;
      const after = query.cursor === undefined ? 0 : decodeLinesCursor(query.cursor, id)?.seq;
      if (after === undefined) return { ok: false, code: 'invalid_request', message: BAD_CURSOR };
      const read = await repository.jobLines({ workspace: key.workspace, job: id, after, take: query.limit + 1 });
      const data = read.slice(0, query.limit);
      const last = data.at(-1);
      return { ok: true, value: { data, next_cursor: read.length > query.limit && last ? encodeLinesCursor({ job: id, seq: last.seq }) : null } };
    },

    /** The questions a job the key may read asked (PRD 2425 s6): the lead and the questions, where they stand, the answers once given
     * and who closed them. A job that asked none is not found, in its own words. */
    async jobQuestions(key: ApiKeyCaller, id: string): Promise<Answered<ApiQuestions>> {
      const found = await readJob(key, id);
      if (!found.ok) return found;
      const asked = await runners.questionsByKey(key.workspace, id);
      return asked.ok ? { ok: true, value: questionsOf(asked.value) } : closeRefusal(asked.kind, asked.error);
    },

    /** The key answers the questions of a job it may read (PRD 2425 s6), as the Runners page's answer would: the answers one to each
     * question, the resume job queued as the job's key and maker, continuing the job, and the round closed as this key in one
     * step. Answers the resume job. The first close wins: a second answer or dismissal, a key's or a person's, is a conflict. */
    answerJob(key: ApiKeyCaller, id: string, body: AnswerJob): Promise<Answered<ApiJob>> {
      return actOnJob(key, id, () => runners.answerByKey(closerOf(key, body), id, body.answers));
    },

    /** The key closes the questions of a job it may read with no answer and no job queued (PRD 2425 s6). Answers the job, its questions
     * dismissed; a second close is a conflict. */
    dismissJob(key: ApiKeyCaller, id: string, body: DismissJob): Promise<Answered<ApiJob>> {
      return actOnJob(key, id, () => runners.dismissByKey(closerOf(key, body), id));
    },

    /** The key cancels a job it may read (PRD 2425 s7), as the Runners page's Cancel does: a queued or claimed job ends at once, a running one
     * is asked to stop, and the key (with whom it acted for) is recorded on it. Answers the job; an ended job is a conflict. */
    cancelJob(key: ApiKeyCaller, id: string, body: CancelJob): Promise<Answered<ApiJob>> {
      return actOnJob(key, id, () => runners.cancelByKey(closerOf(key, body), id));
    },

    /** The key relaunches a job it may read (PRD 2425 s7), as the Runners page offers: Send again for a failed or cancelled one, Resume for one
     * stopped mid-way. Answers the new job, queued as the job's key and maker, continuing it, its notify_url kept. A job the page offers neither
     * for, and one already carried on, are a conflict. */
    relaunchJob(key: ApiKeyCaller, id: string, body: RelaunchJob): Promise<Answered<ApiJob>> {
      return actOnJob(key, id, () => runners.relaunchByKey(closerOf(key, body), id), relaunchRefusal);
    },
  };
}

export type PublicApiService = ReturnType<typeof publicApiService>;
