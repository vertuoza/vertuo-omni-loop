import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import type { Question } from '../runners.contract';
import type { Acted, AppOfJob, JobLineRow, JobPatch, JobRow, JobRowStatus, NewJob, NewRunner, QuestionsRow, RunnerRow, RunnersRepository, SampleRow } from '../runners.repository';

// The runners' storage in memory (PRD 1830 s1), for the service's and the controller's tests: the same
// rows the two tables hold, the claim's rules as runner_claim() applies them, and runners_mark_lost(),
// as supabase/migrations/20261207100000_runners.sql writes them and supabase/checks/runners.sql proves
// them; and a job's live lines (PRD 1904), appended once each, trimmed and kept for the listed jobs as
// supabase/migrations/20261208090000_runner_job_lines.sql and runner_job_lines_retain() keep them; and a
// runner's samples (PRD 2102), one per runner and instant, as runner_samples holds them; and a job's
// questions (PRD 2255), with runner_job_answer() and runner_job_dismiss() as
// supabase/migrations/20261218100000_runner_job_questions.sql writes them and
// supabase/checks/runner_job_questions.sql proves them; and an API key's GitHub App (PRD 2433), with
// runner_claim() keeping a job that needs an App from a runner that did not register `githubApp`, and
// api_key_github_app_of_job() and api_key_github_app_minted() as supabase/migrations/20261228090000_api_key_github_apps.sql
// writes them. A realistic workspace: Olga owns it and plays in
// the fleet cia, Mo plays in cia, Pia in pirates, Sam in no fleet; Eve belongs to another workspace.

export const WORKSPACE = '00000000-0000-4000-8000-000001830001';
export const ELSEWHERE = '00000000-0000-4000-8000-000001830002';

export const OLGA = '00000000-0000-4000-8000-0000018300a1';
export const MO = '00000000-0000-4000-8000-0000018300b1';
export const PIA = '00000000-0000-4000-8000-0000018300c1';
export const SAM = '00000000-0000-4000-8000-0000018300d1';
export const EVE = '00000000-0000-4000-8000-0000018300e1';

export const SHARED = '00000000-0000-4000-8000-0000018301a1';
export const CIA_BOX = '00000000-0000-4000-8000-0000018301b1';
export const OTHER = '00000000-0000-4000-8000-0000018301c1';

/** The fixed clock's start. */
export const T0 = new Date('2026-10-13T12:00:00.000Z');

type Member = { workspaceId: string; userId: string; role: 'owner' | 'member'; team: string | null; login: string | null };

const MEMBERS: Member[] = [
  { workspaceId: WORKSPACE, userId: OLGA, role: 'owner', team: 'cia', login: 'olga' },
  { workspaceId: WORKSPACE, userId: MO, role: 'member', team: 'cia', login: 'mo' },
  { workspaceId: WORKSPACE, userId: PIA, role: 'member', team: 'pirates', login: 'pia' },
  { workspaceId: WORKSPACE, userId: SAM, role: 'member', team: null, login: null },
  { workspaceId: ELSEWHERE, userId: EVE, role: 'owner', team: null, login: 'eve' },
];

/** Olga's API key, which sends in WORKSPACE. */
export const API_KEY = '00000000-0000-4000-8000-0000018302a1';
const KEYS = [{ id: API_KEY, workspaceId: WORKSPACE, name: 'QA dashboard' }];

/** A key's GitHub App as api_key_github_apps holds it, its private key sealed (the fake never opens one). */
export type KeyApp = NonNullable<AppOfJob['app']>;

/** A key's App as the tests build one: id 123456, slug `acme-bugs`, bot 777, a sealed key. */
export const KEY_APP: KeyApp = { app_id: 123456, slug: 'acme-bugs', bot_id: 777, ciphertext: 'sealed-private-key', iv: 'its-iv' };

/** What the tests set up of the keys: the App a key holds, and whether it still works (not revoked, its maker a member). */
export type KeyState = { id: string; app: KeyApp | null; working: boolean };

const FLEETS = [{ workspaceId: WORKSPACE, name: 'cia' }, { workspaceId: WORKSPACE, name: 'pirates' }];

/** Which workspace owns a repository's GitHub organisation. */
const ORGS: Record<string, string> = { 'demo-org': WORKSPACE, elsewhere: ELSEWHERE };

/** A runner row, seen at `T0` unless told otherwise. */
export function runnerRow(more: Partial<RunnerRow> & Pick<RunnerRow, 'id' | 'name'>): RunnerRow {
  return { workspace_id: WORKSPACE, owner: OLGA, fleet: null, slots: 4, repos: ['demo-org/app'], version: '0.0.387', last_seen_at: T0.toISOString(), health: null, github_app: false, ...more };
}

/** Olga's three runners: a shared one with one slot, one of the fleet cia, one that holds another repository. */
export const RUNNERS: RunnerRow[] = [
  runnerRow({ id: SHARED, name: 'shared', slots: 1 }),
  runnerRow({ id: CIA_BOX, name: 'cia-box', fleet: 'cia' }),
  runnerRow({ id: OTHER, name: 'other', repos: ['demo-org/other'] }),
];

let jobSeq = 0;

/** A queued job, sent by Mo to any runner unless told otherwise. */
export function jobRow(more: Partial<JobRow> = {}): JobRow {
  jobSeq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(1830020000 + jobSeq).padStart(12, '0')}`, workspace_id: WORKSPACE, line: '/omni:yolo 1717',
    repo: 'demo-org/app', to_runner: null, to_fleet: null, sent_by: MO, sent_by_app: null, sent_by_key: null, status: 'queued', runner_id: null, cancel_requested: false,
    log_tail: '', pr_url: null, exit_code: null, reason: null, queued_at: T0.toISOString(), claimed_at: null, running_at: null,
    ended_at: null, ...more,
  };
}

/** One question, in `omni ask`'s file shape: two fixes and the one that stops to design. */
export const QUESTION: Question = {
  question: 'Which fix?', header: 'Fix', multiSelect: false,
  options: [
    { label: 'Guard the input', description: 'Check the tenant before the query' },
    { label: 'Design it first', description: 'Stop here and brainstorm the behaviour' },
  ],
};

/** The questions a job asked: open, about issue 314, in WORKSPACE, unless told otherwise. */
export function questionsRow(more: Partial<QuestionsRow> & Pick<QuestionsRow, 'job_id'>): QuestionsRow {
  return {
    workspace_id: WORKSPACE, issue: parseIssue(314), lead: 'The planning query fails for 31 tenants.', questions: [QUESTION],
    answers: null, closed_by: null, closed_at: null, resume_job: null, asked_at: T0.toISOString(), ...more,
  };
}

/** `count` live lines of the job, numbered from `from`, each reading `line <seq>`. */
export function lineRows(job: Pick<JobRow, 'id' | 'workspace_id'>, from: number, count: number): JobLineRow[] {
  return Array.from({ length: count }, (_, i) => ({ job_id: job.id, workspace_id: job.workspace_id, seq: from + i, text: `line ${String(from + i)}` }));
}

const ENDED_STATUSES: readonly JobRowStatus[] = ['done', 'failed', 'cancelled'];

/** A skill of a repository's own its owner allowed on the runners (PRD 2313), as repository_runner_skills holds it. */
export type AllowedSkillRow = { workspace_id: string; full_name: string; skill: string };

/** The fake's tables, and the clock it stamps writes with. */
export function fakeStore({ runners = RUNNERS, jobs = [], lines = [], samples = [], questions = [], skills = [], keys = [], needsApp = [], now = () => T0 }: {
  runners?: RunnerRow[]; jobs?: JobRow[]; lines?: JobLineRow[]; samples?: SampleRow[]; questions?: QuestionsRow[]; skills?: AllowedSkillRow[];
  /** The keys that hold an App, or no longer work; a key not listed holds none and works. */
  keys?: KeyState[];
  /** Jobs that need an App though their key holds none now (queued while it did: runner_job_needs_app). */
  needsApp?: string[];
  now?: () => Date;
} = {}) {
  const calls: string[] = [];
  const state = {
    runners: runners.map((row) => ({ ...row })), jobs: jobs.map((row) => ({ ...row })), lines: lines.map((row) => ({ ...row })),
    samples: samples.map((row) => ({ ...row })), questions: questions.map((row) => ({ ...row })), skills: skills.map((row) => ({ ...row })), calls,
    keys: keys.map((row) => ({ ...row })), needsApp: new Set(needsApp), minted: [] as string[],
  };
  const stamp = () => now().toISOString();
  const keyOf = (id: string | null): KeyState | undefined => state.keys.find((k) => k.id === id);
  // As runner_job_needs_app_mark() marks a job queued while its key held an App, and api_key_github_app_of_job() reads it.
  const holdsApp = (job: Pick<JobRow, 'sent_by_key'>) => (keyOf(job.sent_by_key)?.app ?? null) !== null;
  const needsAppJob = (job: JobRow) => state.needsApp.has(job.id) || holdsApp(job);
  for (const job of state.jobs) if (holdsApp(job)) state.needsApp.add(job.id);
  // As runner_claim() reads them: a queued job of its workspace, for a repository it holds…
  const takeable = (runner: RunnerRow, job: JobRow) =>
    job.workspace_id === runner.workspace_id && job.status === 'queued' && !job.cancel_requested && runner.repos.includes(job.repo);
  // …sent to it, to its fleet, or, for a runner with no fleet only, to any runner.
  const addressed = (runner: RunnerRow, job: JobRow) => (job.to_runner === null ? job.to_fleet === runner.fleet : job.to_runner === runner.id);
  // …and a job that needs an App goes only to a runner that registered `githubApp`.
  const may = (runner: RunnerRow, job: JobRow) => takeable(runner, job) && addressed(runner, job) && (runner.github_app || !needsAppJob(job));
  // Why runner_job_answer() and runner_job_dismiss() refuse before they change anything: no row, a closed row or a
  // job that is not waiting, an account outside the workspace.
  const refusal = (jobId: string, by: string): 'none' | 'closed' | 'stranger' | null => {
    const row = state.questions.find((q) => q.job_id === jobId);
    if (!row) return 'none';
    if (row.closed_at !== null || state.jobs.find((j) => j.id === jobId)?.outcome !== 'human') return 'closed';
    return MEMBERS.some((m) => m.workspaceId === row.workspace_id && m.userId === by) ? null : 'stranger';
  };

  const store: RunnersRepository = {
    member: (workspaceId, userId) => {
      const found = MEMBERS.find((m) => m.workspaceId === workspaceId && m.userId === userId);
      return Promise.resolve(found ? { owner: found.role === 'owner', fleet: found.team } : null);
    },
    place: (userId, repo) => {
      const owning = ORGS[repo.split('/')[0] ?? ''];
      if (owning && MEMBERS.some((m) => m.workspaceId === owning && m.userId === userId)) return Promise.resolve({ workspaceId: owning, refusal: null });
      return Promise.resolve({ workspaceId: null, refusal: owning ? `you are not a member of the workspace that owns ${repo}` : `no workspace owns ${repo}` });
    },
    fleetExists: (workspaceId, fleet) => Promise.resolve(FLEETS.some((f) => f.workspaceId === workspaceId && f.name === fleet)),
    logins: (workspaceId, userIds) => Promise.resolve(new Map(MEMBERS.flatMap((m) => (
      m.workspaceId === workspaceId && userIds.includes(m.userId) && m.login ? [[m.userId, m.login] as const] : []
    )))),
    keyNames: (workspaceId, keyIds) => Promise.resolve(new Map(KEYS.filter((k) => k.workspaceId === workspaceId && keyIds.includes(k.id)).map((k) => [k.id, k.name] as const))),
    appOfJob: (jobId) => {
      state.calls.push(`app of job ${jobId}`);
      const job = state.jobs.find((j) => j.id === jobId);
      if (!job || job.sent_by_key === null) return Promise.resolve(null);
      const key = keyOf(job.sent_by_key);
      return Promise.resolve({ key_id: job.sent_by_key, workspace_id: job.workspace_id, working: key?.working ?? true, needs_app: needsAppJob(job), app: key?.app ?? null });
    },
    appMinted: (keyId) => {
      state.calls.push(`minted ${keyId}`);
      state.minted.push(keyId);
      return Promise.resolve();
    },
    // As repository_runner_skills_of() reads them: the repository's names, in order.
    allowedSkills: (workspaceId, repo) => Promise.resolve(state.skills
      .filter((row) => row.workspace_id === workspaceId && row.full_name === repo.toLowerCase()).map((row) => row.skill).sort()),
    runner: (id) => Promise.resolve(state.runners.find((r) => r.id === id) ?? null),
    runnerNamed: (workspaceId, name) => Promise.resolve(state.runners.find((r) => r.workspace_id === workspaceId && r.name === name) ?? null),
    runners: (workspaceId) => Promise.resolve(state.runners.filter((r) => r.workspace_id === workspaceId).sort((a, b) => a.name.localeCompare(b.name))),
    insertRunner: (runner: NewRunner) => {
      const row = runnerRow({
        id: `00000000-0000-4000-8000-${String(1830010000 + state.runners.length).padStart(12, '0')}`, workspace_id: runner.workspaceId,
        owner: runner.owner, name: runner.name, slots: runner.slots, repos: runner.repos, version: runner.version, last_seen_at: runner.seenAt,
        github_app: runner.githubApp,
      });
      state.runners.push(row);
      state.calls.push(`insert runner ${runner.name}`);
      return Promise.resolve(row);
    },
    updateRunner: (id, patch) => {
      const row = state.runners.find((r) => r.id === id);
      if (!row) return Promise.reject(new Error('runners: no row'));
      Object.assign(row, patch);
      return Promise.resolve({ ...row });
    },
    insertSample: (row) => {
      // As `insert … on conflict (runner_id, at) do nothing`.
      if (!state.samples.some((held) => held.runner_id === row.runner_id && held.at === row.at)) state.samples.push({ ...row });
      return Promise.resolve();
    },
    trimSamples: (runnerId, before) => {
      state.samples = state.samples.filter((row) => row.runner_id !== runnerId || Date.parse(row.at) >= Date.parse(before));
      return Promise.resolve();
    },
    samples: (runnerIds, since) => Promise.resolve(state.samples
      .filter((row) => runnerIds.includes(row.runner_id) && Date.parse(row.at) >= Date.parse(since))
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((row) => ({ ...row }))),
    markLost: (cutoff) => {
      let lost = 0;
      for (const job of state.jobs) {
        const runner = state.runners.find((r) => r.id === job.runner_id);
        if (runner && (job.status === 'claimed' || job.status === 'running') && Date.parse(runner.last_seen_at) < Date.parse(cutoff)) {
          Object.assign(job, { status: 'failed', reason: 'runner lost', ended_at: stamp() });
          lost += 1;
        }
      }
      return Promise.resolve(lost);
    },
    claim: (runnerId) => {
      state.calls.push(`claim ${runnerId}`);
      const runner = state.runners.find((r) => r.id === runnerId);
      if (!runner) return Promise.resolve(null);
      const busy = state.jobs.filter((j) => j.runner_id === runner.id && (j.status === 'claimed' || j.status === 'running')).length;
      if (busy >= runner.slots) return Promise.resolve(null);
      const job = state.jobs.filter((j) => may(runner, j)).sort((a, b) => a.queued_at.localeCompare(b.queued_at) || a.id.localeCompare(b.id))[0];
      if (!job) return Promise.resolve(null);
      Object.assign(job, { status: 'claimed', runner_id: runner.id, claimed_at: stamp() });
      return Promise.resolve({ ...job });
    },
    job: (id) => {
      const found = state.jobs.find((j) => j.id === id);
      return Promise.resolve(found ? { ...found } : null);
    },
    insertJob: (job: NewJob) => {
      const row = jobRow({ workspace_id: job.workspaceId, line: job.line, repo: job.repo, to_runner: job.toRunner, to_fleet: job.toFleet, sent_by: job.sentBy, sent_by_key: job.sentByKey, queued_at: stamp() });
      state.jobs.push(row);
      if (holdsApp(row)) state.needsApp.add(row.id);
      return Promise.resolve({ ...row });
    },
    updateJob: (id, from: readonly JobRowStatus[], patch: JobPatch) => {
      const row = state.jobs.find((j) => j.id === id && from.includes(j.status));
      if (!row) return Promise.resolve(null);
      Object.assign(row, patch);
      return Promise.resolve({ ...row });
    },
    appendLines: (rows) => {
      // As `insert … on conflict (job_id, seq) do nothing`: a line already held stays as it is.
      const held = new Set(state.lines.map((row) => `${row.job_id} ${String(row.seq)}`));
      for (const row of rows) if (!held.has(`${row.job_id} ${String(row.seq)}`)) state.lines.push({ ...row });
      return Promise.resolve();
    },
    trimLines: (jobId, upTo) => {
      state.lines = state.lines.filter((row) => row.job_id !== jobId || row.seq > upTo);
      return Promise.resolve();
    },
    retainLines: (workspaceId, keep) => {
      // As runner_job_lines_retain(): the workspace's ended jobs, newest first, beyond the first `keep`.
      const gone = new Set(state.jobs
        .filter((j) => j.workspace_id === workspaceId && ENDED_STATUSES.includes(j.status))
        .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? '') || b.id.localeCompare(a.id))
        .slice(keep)
        .map((j) => j.id));
      const before = state.lines.length;
      state.lines = state.lines.filter((row) => !gone.has(row.job_id));
      return Promise.resolve(before - state.lines.length);
    },
    lines: (jobId, after, limit) => Promise.resolve(state.lines
      .filter((row) => row.job_id === jobId && row.seq > after)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit)
      .map((row) => ({ seq: row.seq, text: row.text }))),
    firstLine: (jobId) => Promise.resolve(state.lines.filter((row) => row.job_id === jobId).reduce<number | null>((first, row) => (first === null || row.seq < first ? row.seq : first), null)),
    activeJobs: (workspaceId) => Promise.resolve(state.jobs.filter((j) => j.workspace_id === workspaceId && ['queued', 'claimed', 'running'].includes(j.status))),
    endedJobs: (workspaceId, limit) => Promise.resolve(state.jobs
      .filter((j) => j.workspace_id === workspaceId && j.ended_at !== null)
      .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''))
      .slice(0, limit)),
    jobsById: (workspaceId, ids) => Promise.resolve(state.jobs
      .filter((j) => j.workspace_id === workspaceId && ids.includes(j.id))
      .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''))
      .map((j) => ({ ...j }))),
    questionsOf: (jobId) => {
      const found = state.questions.find((q) => q.job_id === jobId);
      return Promise.resolve(found ? { ...found } : null);
    },
    insertQuestions: (row) => {
      // One row per job, as its primary key: a second insert reads none.
      if (state.questions.some((q) => q.job_id === row.jobId)) return Promise.resolve(null);
      const added = questionsRow({ job_id: row.jobId, workspace_id: row.workspaceId, issue: row.issue, lead: row.lead, questions: row.questions, asked_at: stamp() });
      state.questions.push(added);
      return Promise.resolve({ ...added });
    },
    openQuestionJobs: (workspaceId) => Promise.resolve(state.questions.filter((q) => q.workspace_id === workspaceId && q.closed_at === null).map((q) => q.job_id)),
    answer: (jobId, answers, by) => {
      state.calls.push(`answer ${jobId} by ${by}`);
      const refused = refusal(jobId, by);
      const row = state.questions.find((q) => q.job_id === jobId);
      const asked = state.jobs.find((j) => j.id === jobId);
      if (refused || !row || !asked) return Promise.resolve<Acted<JobRow>>({ ok: false, refusal: refused ?? 'none' });
      // As runner_job_answer(): each question has one answer, and nothing else is answered.
      const texts = row.questions.map((q) => q.question);
      const keys = Object.keys(answers);
      const skill = /^\/omni:([a-z][a-z-]*)/.exec(asked.line)?.[1];
      if (keys.length !== texts.length || !texts.every((text) => text in answers) || !skill) return Promise.resolve({ ok: false, refusal: 'mismatch' });
      // …the resume job is queued as the answerer, to the first job's repository and target, then the row closes.
      const resume = jobRow({
        workspace_id: asked.workspace_id, line: `/omni:${skill} #${String(row.issue)} --answers ${jobId}`, repo: asked.repo,
        to_runner: asked.to_runner, to_fleet: asked.to_fleet, sent_by: by, queued_at: stamp(),
      });
      state.jobs.push(resume);
      Object.assign(row, { answers: { ...answers }, closed_by: by, closed_at: stamp(), resume_job: resume.id });
      return Promise.resolve({ ok: true, value: { ...resume } });
    },
    dismiss: (jobId, by) => {
      state.calls.push(`dismiss ${jobId} by ${by}`);
      const refused = refusal(jobId, by);
      const row = state.questions.find((q) => q.job_id === jobId);
      if (refused || !row) return Promise.resolve<Acted<QuestionsRow>>({ ok: false, refusal: refused ?? 'none' });
      Object.assign(row, { closed_by: by, closed_at: stamp() });
      return Promise.resolve({ ok: true, value: { ...row } });
    },
  };
  return { store, state };
}
