// `omni roadmap check [<n>] | push <n> | answer <n> <question> "<answer>" | prereqs <n> | tick <n> <id>`
// (PRD 1162, PRD 1218).
//
// - `check [<n>]` (slice s4) grades every roadmap of the inbox, or roadmap n alone, through
//   `kit/lib/roadmap/` (`index.ts` says where they live, `grade.ts` what it refuses). Prints, for each
//   roadmap, its PRDs wave by wave, then every violation (exit 1) or its pass line. An inbox with no
//   roadmap passes; a roadmap number with no folder is a usage error, exit 2.
// - `push <n>` (slice s6) sends roadmap n's `roadmap.md`, its open questions with the latest answer
//   to each (read from the roadmap issue's comments, `../../lib/roadmap/answers.ts`) and where each of
//   its PRDs stands (read from their feature PRs, `../../lib/roadmap/push.ts`) to the app's
//   `POST /api/roadmaps`, with the terminal's sign-in. It never blocks the tick that runs it: the
//   contract's 5-second limit and one token refresh, and anything that stops it is exit 1 with one
//   line — `off` (no `ask.url`), `no sign-in (omni signin)`, `github unreachable`, `unreachable`,
//   `refused (<status>)` or `refused (<status>): <the app's reason>`, or a roadmap.md that does not
//   parse.
// - `answer <n> <question> "<answer>"` (slice s6) posts one comment on roadmap n's issue carrying the
//   answer's marker: how a person's answer reaches the repository's side. The roadmap's page builds
//   this very line. An unknown question, or an empty or too long answer, is exit 2.
// - `prereqs <n> [--fix] [--json]` (PRD 1218, slice s3) runs roadmap n's `## Prerequisites` rows on
//   this machine through `../../lib/roadmap/prereqs/` (with `--fix`, the agent rows' fixes once),
//   reading the ticks from the roadmap issue's comments; prints one line per row grouped by category
//   (`ok`, `fixed`, `ticked`, or `waits on you` with its card's command), or the result as JSON;
//   keeps it as this machine's last result, and pushes it with the roadmap. A push that fails is one
//   line on stderr and never changes the exit: 0 when every row is ok, fixed or ticked, 1 otherwise.
//   `push` alone carries this machine's last result.
// - `tick <n> <id>` (slice s3) posts the comment that ticks `person` row `id`, as `answer` does; any
//   other id is exit 2.
//
// It runs before a context exists, like `loop`, so that a test can hand it `tokens`, `home`, `fetch`
// and `callMs`; it loads the context itself.
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { formatFailure, formatPass, readRepoFile } from '../../lib/check-report.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { ANSWER_MAX, answerComment, readAnswers } from '../../lib/roadmap/answers.ts';
import { gradeRoadmaps, roadmapFiles } from '../../lib/roadmap/index.ts';
import type { GradedRoadmap, RoadmapFile } from '../../lib/roadmap/index.ts';
import { parseRoadmap, PREREQUISITE_CATEGORIES, roadmapWaves } from '../../lib/roadmap/parse.ts';
import type { Roadmap, RoadmapPrerequisite } from '../../lib/roadmap/parse.ts';
import type { Shell } from '../../lib/roadmap/prereqs/catalog.ts';
import { probesFor } from '../../lib/roadmap/prereqs/catalog.ts';
import { lastResultOf, readLastResult, writeLastResult } from '../../lib/roadmap/prereqs/last.ts';
import type { LastResult } from '../../lib/roadmap/prereqs/last.ts';
import { liveEnv, machineName } from '../../lib/roadmap/prereqs/live.ts';
import { isMet, PREREQUISITE_STATES, runPrerequisites } from '../../lib/roadmap/prereqs/run.ts';
import type { PrerequisiteResult, PrerequisiteState } from '../../lib/roadmap/prereqs/run.ts';
import { readTicks, tickComment } from '../../lib/roadmap/prereqs/ticks.ts';
import { readStandings, roadmapPushBody } from '../../lib/roadmap/push.ts';
import type { PushedPrerequisiteResult } from '../../lib/roadmap/push.ts';
import { issueArg, parseArgs, println, usageError } from '../args.ts';
import { githubClientFor, githubEnv } from '../github.ts';
import type { Env, Exec, FreeCommand, FreeIo, Out } from '../io.ts';

/** What a test hands `omni roadmap` beyond `main()`'s own: the sign-in and the app, and for
 * `prereqs` the command runner its checks go through, this machine's name and the clock. */
type RoadmapOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  prereqShell?: Shell | undefined;
  machine?: string | undefined;
  now?: (() => Date) | undefined;
};

const USAGE = [
  'usage: omni roadmap check [<n>]',
  '       omni roadmap push <n>',
  '       omni roadmap answer <n> <question> "<answer>"',
  '       omni roadmap prereqs <n> [--fix] [--json]',
  '       omni roadmap tick <n> <id>',
].join('\n');

// ── check ────────────────────────────────────────────────────────────────────────────────────────

/** One roadmap's waves, then its violations or its pass line; whether it passed. */
function report(stdout: Out, graded: GradedRoadmap): boolean {
  const { number, file, roadmap, violations } = graded;
  if (roadmap !== null) {
    const waves = roadmapWaves(roadmap);
    println(stdout, `omni roadmap check — roadmap ${number}: ${roadmap.prds.length} PRD(s) across ${waves.length} wave(s) (${file}).`);
    for (const { wave, rows } of waves) {
      const members = rows.map((row) => `${row.id} #${row.prd}${row.repos === null ? '' : ` (${row.repos.join(', ')})`}`);
      println(stdout, `  wave ${wave}: ${members.join(', ')}`);
    }
  }
  if (violations.length > 0) {
    println(stdout, formatFailure(`omni roadmap check — roadmap ${number}: violation(s):`, violations));
    return false;
  }
  println(stdout, formatPass(`omni roadmap check — roadmap ${number}: every row, blocker and question holds.`));
  return true;
}

/** `omni roadmap check [<n>]`: exit 0 when every roadmap graded passes, 1 otherwise. */
function checkCommand(rest: string[], { ctx, stdout }: { ctx: Context; stdout: Out }): number {
  const { positional } = parseArgs('roadmap check', rest);
  if (positional.length > 1) throw usageError(USAGE);
  const wanted = positional[0] === undefined ? null : issueArg('roadmap check', '<n>', positional[0]);
  const all = gradeRoadmaps(ctx);
  const graded = wanted === null ? all : all.filter((entry) => entry.number === wanted);
  if (wanted !== null && graded.length === 0) throw usageError(`omni roadmap check: roadmap ${wanted} has no folder under the inbox's roadmaps.`);
  if (graded.length === 0) {
    println(stdout, formatPass('omni roadmap check — no roadmap in the inbox.'));
    return 0;
  }
  const passed = graded.map((entry) => report(stdout, entry));
  return passed.every(Boolean) ? 0 : 1;
}

// ── push and answer ──────────────────────────────────────────────────────────────────────────────

type Io = FreeIo & RoadmapOptions;

/** Prints the one line a push stops with: exit 1. */
function refuse(stderr: Out, line: string): number {
  println(stderr, line);
  return 1;
}

/** Roadmap `n`'s folder, or a usage error naming the command when it has none. */
function roadmapFile(ctx: Context, verb: string, n: IssueNumber): RoadmapFile {
  const entry = roadmapFiles(ctx).find((file) => file.number === n);
  if (!entry) throw usageError(`omni roadmap ${verb}: roadmap ${n} has no folder under the inbox's roadmaps.`);
  return entry;
}

/** Roadmap `n`'s text and record, or the line it stops with when it does not parse. */
function readRoadmap(ctx: Context, entry: RoadmapFile): { document: string; roadmap: Roadmap } | string {
  let document: string;
  try {
    document = readRepoFile(ctx, entry.file);
  } catch {
    return `${entry.file} is missing (omni roadmap check ${entry.number})`;
  }
  const parsed = parseRoadmap(document);
  return parsed.ok ? { document, roadmap: parsed.roadmap } : `${entry.file} does not parse (omni roadmap check ${entry.number})`;
}

/** This checkout's context and its repository's slug, or a usage error without one. */
function repoContext({ cwd, exec }: Io): { ctx: Context; repo: string } {
  const ctx = loadContext(cwd, { exec });
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni roadmap: no repository slug — set repo.slug in the config.');
  return { ctx, repo };
}

/** The environment `gh` runs with, or undefined when none can be made. */
function ghEnvOf(ctx: Context, exec: Exec, env: Env): Env | undefined {
  try {
    return githubEnv(ctx, { exec, env });
  } catch {
    return undefined;
  }
}

/** The one line a failed call is reported with; the app's reason after it when it gave one. */
function skipLine(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.reason ? `refused (${error.status}): ${error.reason}` : `refused (${error.status})`;
}

/** What GitHub says of the roadmap: each PRD's standing and the answers, or null when it cannot be read. */
function readGithub(ctx: Context, roadmap: Roadmap, { exec, env }: Io) {
  const ghEnv = ghEnvOf(ctx, exec, env);
  const gh = (args: string[]) => exec('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(ghEnv ? { env: ghEnv } : {}) });
  const git = (args: string[]) => exec('git', args, { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const standings = readStandings(ctx, roadmap, { gh, git });
    const comments = githubClientFor(ctx, { issue: roadmap.roadmap, exec, env }).listComments();
    return { standings, answers: readAnswers(comments) };
  } catch {
    return null;
  }
}

/** What a push sends, and where: the app's address, a signed-in client and the body. */
type PushInputs = {
  askUrl: string;
  client: NonNullable<ReturnType<typeof signedInClient>>;
  body: ReturnType<typeof roadmapPushBody>;
};

/** This machine's name: the one a prerequisites result is kept and shown under. */
const machineOf = (io: Io): string => io.machine ?? machineName();

/** This machine's last prerequisites result for roadmap `n`, as a push carries it; null with none. */
function keptResult(ctx: Context, n: IssueNumber, io: Io): PushedPrerequisiteResult | null {
  const kept = readLastResult(ctx.root, n, machineOf(io));
  if (kept === null) return null;
  const { machine, checkedAt, rows } = kept;
  return { machine, checkedAt, rows };
}

/** Everything roadmap `n`'s push needs before it is sent, or the one line it stops with. The
 * prerequisites `result` is this machine's last unless one is given. */
function pushInputs(n: IssueNumber, io: Io, given?: PushedPrerequisiteResult): PushInputs | string {
  const { ctx, repo } = repoContext(io);
  const entry = roadmapFile(ctx, 'push', n);
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return 'off';
  const read = readRoadmap(ctx, entry);
  if (typeof read === 'string') return read;
  const client = signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs });
  if (!client) return 'no sign-in (omni signin)';
  const github = readGithub(ctx, read.roadmap, io);
  if (github === null) return 'github unreachable';
  const result = given ?? keptResult(ctx, n, io);
  return { askUrl, client, body: roadmapPushBody({ repo, roadmap: read.roadmap, document: read.document, ...github, result }) };
}

/** The app's reply to roadmap `n`'s push, printed: its link and any note, exit 0; 1 with no roadmap in it. */
function reportPush({ stdout, stderr }: Io, n: IssueNumber, { askUrl, body }: PushInputs, reply: unknown): number {
  const roadmapId = field(reply, 'roadmapId');
  if (typeof roadmapId !== 'string' || !roadmapId) return refuse(stderr, 'refused (no roadmap in the reply)');
  const how = field(reply, 'created') === true ? 'created' : 'updated';
  println(stdout, `roadmap ${n}: ${how}, ${body.prds.length} PRD(s) — ${askUrl.replace(/\/+$/, '')}/roadmaps/${roadmapId}`);
  const note = field(reply, 'note');
  if (typeof note === 'string' && note) println(stdout, note);
  return 0;
}

/** `omni roadmap push <n>`: exit 0 once the app took it, 1 with one line otherwise. */
async function pushCommand(rest: string[], io: Io): Promise<number> {
  const { positional } = parseArgs('roadmap push', rest);
  if (positional.length !== 1) throw usageError(USAGE);
  const n = issueArg('roadmap push', '<n>', positional[0]);
  const inputs = pushInputs(n, io);
  if (typeof inputs === 'string') return refuse(io.stderr, inputs);
  let reply: unknown;
  try {
    reply = await inputs.client.pushRoadmap(inputs.body);
  } catch (error) {
    return refuse(io.stderr, skipLine(error));
  }
  return reportPush(io, n, inputs, reply);
}

/** `answer`'s arguments: the roadmap, the question and the trimmed answer; a usage error otherwise. */
function answerArgs(rest: string[]): { n: IssueNumber; question: string; answer: string } {
  const { positional } = parseArgs('roadmap answer', rest);
  if (positional.length !== 3) throw usageError(USAGE);
  const [number, question = '', given = ''] = positional;
  const n = issueArg('roadmap answer', '<n>', number);
  const answer = given.trim();
  if (!answer) throw usageError('omni roadmap answer: the answer is empty.');
  if (answer.length > ANSWER_MAX) throw usageError(`omni roadmap answer: an answer holds ${ANSWER_MAX} characters at most.`);
  return { n, question, answer };
}

/** A usage error unless roadmap `n` asks `question`. */
function assertAsks(roadmap: Roadmap, n: IssueNumber, question: string): void {
  const ids = roadmap.questions.map((q) => q.id);
  if (ids.includes(question)) return;
  throw usageError(`omni roadmap answer: roadmap ${n} has no question ${question}${ids.length ? ` (its questions: ${ids.join(', ')})` : ''}.`);
}

/** `omni roadmap answer <n> <question> "<answer>"`: posts the marked comment, exit 0; 2 on a bad
 * argument; 1 with one line when GitHub refuses it. */
function answerCommand(rest: string[], io: Io): number {
  const { n, question, answer } = answerArgs(rest);
  const { ctx } = repoContext(io);
  const read = readRoadmap(ctx, roadmapFile(ctx, 'answer', n));
  if (typeof read === 'string') return refuse(io.stderr, read);
  assertAsks(read.roadmap, n, question);
  let url: string | null | undefined;
  try {
    url = githubClientFor(ctx, { issue: n, exec: io.exec, env: io.env }).createComment(answerComment(question, answer))?.html_url;
  } catch {
    return refuse(io.stderr, 'github unreachable');
  }
  println(io.stdout, `roadmap ${n}: ${question} answered${url ? ` — ${url}` : ''}`);
  return 0;
}

// ── prereqs and tick (PRD 1218, slice s3) ────────────────────────────────────────────────────────

/** A row's state, in the words a line shows. */
const STATE_WORDS: Record<PrerequisiteState, string> = { ok: 'ok', fixed: 'fixed', ticked: 'ticked', waits: 'waits on you' };

/** `1 ok · 1 fixed · 2 wait on you`: each state the run has, in this order. */
function countLine(results: readonly PrerequisiteResult[]): string {
  const counts = PREREQUISITE_STATES.map((state) => [state, results.filter((result) => result.state === state).length] as const);
  return counts
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${state === 'waits' ? (count === 1 ? 'waits on you' : 'wait on you') : state}`)
    .join(' · ');
}

/** The results grouped by category, in the categories' order, each in table order. */
function byCategory(results: readonly PrerequisiteResult[]): { category: string; rows: PrerequisiteResult[] }[] {
  return PREREQUISITE_CATEGORIES
    .map((category) => ({ category, rows: results.filter((result) => result.prerequisite.category === category) }))
    .filter(({ rows }) => rows.length > 0);
}

/** One row's lines: its state and need, why it waits, and its card's command when it waits. */
function rowLines({ prerequisite, state, detail }: PrerequisiteResult): string[] {
  const why = state === 'waits' && detail ? ` (${detail})` : '';
  const head = `  ${prerequisite.id} ${STATE_WORDS[state]} — ${prerequisite.need}${why}`;
  const command = prerequisite.card?.command;
  return state === 'waits' && command ? [head, `     run: ${command}`] : [head];
}

/** The run, as a person reads it: the count line, then the rows grouped by category. */
function prereqsLines(n: IssueNumber, machine: string, results: readonly PrerequisiteResult[]): string[] {
  const groups = byCategory(results).flatMap(({ category, rows }) => [category, ...rows.flatMap(rowLines)]);
  return [`roadmap ${n} — prerequisites on ${machine}: ${countLine(results)}`, ...groups];
}

/** The run, as `--json` prints it: the result kept, each row with its category, need and command. */
function prereqsJson(result: LastResult, results: readonly PrerequisiteResult[]): string {
  const rows = byCategory(results).flatMap(({ rows: grouped }) => grouped).map(({ prerequisite, state, detail }) => ({
    id: prerequisite.id, category: prerequisite.category, need: prerequisite.need, who: prerequisite.who,
    blocks: prerequisite.blocks, state, detail, command: prerequisite.card?.command ?? null,
  }));
  return JSON.stringify({ roadmap: result.roadmap, machine: result.machine, checkedAt: result.checkedAt, rows }, null, 2);
}

/** The ids ticked on roadmap `n`'s issue; none, with one line saying so, when GitHub cannot be read. */
function readRoadmapTicks(ctx: Context, n: IssueNumber, io: Io): Set<string> {
  try {
    return readTicks(githubClientFor(ctx, { issue: n, exec: io.exec, env: io.env }).listComments());
  } catch {
    println(io.stderr, `roadmap ${n}: the ticks could not be read (github unreachable) — every person row waits.`);
    return new Set();
  }
}

/** Whether this computer is signed in to the app, as the `omni-signin` base check asks. */
function signedInHere(ctx: Context, io: Io): () => boolean {
  const askUrl = ctx.config.ask.url;
  return () => askUrl !== null && signedInClient({ askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs }) !== null;
}

/** Runs roadmap `n`'s prerequisites on this machine, fixing the agent rows with `fix`. */
function runRoadmapPrerequisites(ctx: Context, n: IssueNumber, prerequisites: readonly RoadmapPrerequisite[], fix: boolean, io: Io): Promise<PrerequisiteResult[]> {
  const env = { ...liveEnv({ root: ctx.root, labels: ctx.config.labels, signedIn: signedInHere(ctx, io) }), ...(io.prereqShell ? { shell: io.prereqShell } : {}) };
  return runPrerequisites(prerequisites, { probes: (prerequisite) => probesFor(prerequisite, env), ticks: readRoadmapTicks(ctx, n, io), fix });
}

/** Sends the run to the roadmap's page: its link on stdout (stderr under `--json`), or one line on
 * stderr when it could not be sent. Never changes the exit code. */
async function pushPrereqs(n: IssueNumber, io: Io, result: LastResult, json: boolean): Promise<void> {
  const { machine, checkedAt, rows } = result;
  const inputs = pushInputs(n, io, { machine, checkedAt, rows });
  const notUpdated = (why: string) => println(io.stderr, `roadmap ${n}: the page is not updated (${why})`);
  if (typeof inputs === 'string') return notUpdated(inputs);
  let reply: unknown;
  try {
    reply = await inputs.client.pushRoadmap(inputs.body);
  } catch (error) {
    return notUpdated(skipLine(error));
  }
  const roadmapId = field(reply, 'roadmapId');
  if (typeof roadmapId !== 'string' || !roadmapId) return notUpdated('no roadmap in the reply');
  println(json ? io.stderr : io.stdout, `roadmap ${n}: the page is updated — ${inputs.askUrl.replace(/\/+$/, '')}/roadmaps/${roadmapId}`);
}

/** `omni roadmap prereqs <n> [--fix] [--json]`: runs, prints, keeps and pushes roadmap n's
 * prerequisites; exit 0 when every row is ok, fixed or ticked, 1 otherwise. */
async function prereqsCommand(rest: string[], io: Io): Promise<number> {
  const { positional, flags } = parseArgs('roadmap prereqs', rest, { booleans: ['fix', 'json'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const n = issueArg('roadmap prereqs', '<n>', positional[0]);
  const { ctx } = repoContext(io);
  const read = readRoadmap(ctx, roadmapFile(ctx, 'prereqs', n));
  if (typeof read === 'string') return refuse(io.stderr, read);
  const prerequisites = read.roadmap.prerequisites ?? [];
  if (prerequisites.length === 0) {
    println(io.stdout, `roadmap ${n} — no prerequisites: nothing to check.`);
    return 0;
  }
  const results = await runRoadmapPrerequisites(ctx, n, prerequisites, flags.fix === true, io);
  const machine = machineOf(io);
  const result = lastResultOf(results, { roadmap: n, machine, checkedAt: (io.now?.() ?? new Date()).toISOString() });
  writeLastResult(ctx.root, result);
  const json = flags.json === true;
  println(io.stdout, json ? prereqsJson(result, results) : prereqsLines(n, machine, results).join('\n'));
  await pushPrereqs(n, io, result, json);
  return results.every((entry) => isMet(entry.state)) ? 0 : 1;
}

/** A usage error unless roadmap `n` has a `person` row `id`. */
function assertPersonRow(roadmap: Roadmap, n: IssueNumber, id: string): void {
  const rows = roadmap.prerequisites ?? [];
  const persons = rows.filter((row) => row.who === 'person').map((row) => row.id);
  const theirs = ` (its person rows: ${persons.length > 0 ? persons.join(', ') : 'none'}).`;
  const row = rows.find((candidate) => candidate.id === id);
  if (row === undefined) throw usageError(`omni roadmap tick: roadmap ${n} has no prerequisite ${id}${theirs}`);
  if (row.who !== 'person') throw usageError(`omni roadmap tick: ${id} is a ${row.who} row of roadmap ${n} — only a person row is ticked${theirs}`);
}

/** `omni roadmap tick <n> <id>`: posts the tick's marked comment on roadmap n's issue, exit 0; 2 on a
 * bad argument or a row that is not a `person` row; 1 with one line when GitHub refuses it. */
function tickCommand(rest: string[], io: Io): number {
  const { positional } = parseArgs('roadmap tick', rest);
  if (positional.length !== 2) throw usageError(USAGE);
  const n = issueArg('roadmap tick', '<n>', positional[0]);
  const id = positional[1] ?? '';
  const { ctx } = repoContext(io);
  const read = readRoadmap(ctx, roadmapFile(ctx, 'tick', n));
  if (typeof read === 'string') return refuse(io.stderr, read);
  assertPersonRow(read.roadmap, n, id);
  let url: string | null | undefined;
  try {
    url = githubClientFor(ctx, { issue: n, exec: io.exec, env: io.env }).createComment(tickComment(id))?.html_url;
  } catch {
    return refuse(io.stderr, 'github unreachable');
  }
  println(io.stdout, `roadmap ${n}: ${id} ticked${url ? ` — ${url}` : ''}`);
  return 0;
}

export const roadmap = {
  withoutContext: true,
  async run(args: string[], io: Io) {
    const [sub, ...rest] = args;
    if (sub === 'check') return checkCommand(rest, { ctx: loadContext(io.cwd, { exec: io.exec }), stdout: io.stdout });
    if (sub === 'push') return pushCommand(rest, io);
    if (sub === 'answer') return answerCommand(rest, io);
    if (sub === 'prereqs') return prereqsCommand(rest, io);
    if (sub === 'tick') return tickCommand(rest, io);
    throw usageError(USAGE);
  },
} satisfies FreeCommand;
