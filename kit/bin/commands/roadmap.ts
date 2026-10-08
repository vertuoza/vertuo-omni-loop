// `omni roadmap check [<n>] | push <n> | answer <n> <question> "<answer>"` (PRD 1162).
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
//   parse. Once the app took it, it keeps the roadmap page it printed as the roadmap's link in the
//   main checkout (`../../lib/now/links.ts`, PRD 1208's s4), for `omni now`; a link it cannot keep
//   changes nothing of the push.
// - `answer <n> <question> "<answer>"` (slice s6) posts one comment on roadmap n's issue carrying the
//   answer's marker: how a person's answer reaches the repository's side. The roadmap's page builds
//   this very line. An unknown question, or an empty or too long answer, is exit 2.
//
// It runs before a context exists, like `loop`, so that a test can hand it `tokens`, `home`, `fetch`
// and `callMs`; it loads the context itself.
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { formatFailure, formatPass, readRepoFile } from '../../lib/check-report.ts';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { writeLinks } from '../../lib/now/links.ts';
import type { Context } from '../../lib/context.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { ANSWER_MAX, answerComment, readAnswers } from '../../lib/roadmap/answers.ts';
import { gradeRoadmaps, roadmapFiles } from '../../lib/roadmap/index.ts';
import type { GradedRoadmap, RoadmapFile } from '../../lib/roadmap/index.ts';
import { parseRoadmap, roadmapWaves } from '../../lib/roadmap/parse.ts';
import type { Roadmap } from '../../lib/roadmap/parse.ts';
import { readStandings, roadmapPushBody } from '../../lib/roadmap/push.ts';
import { issueArg, parseArgs, println, usageError } from '../args.ts';
import { githubClientFor, githubEnv } from '../github.ts';
import type { Env, Exec, FreeCommand, FreeIo, Out } from '../io.ts';

/** Keeps `page` as roadmap `n`'s link in the main checkout of `cwd`, at `now`; never throws. */
function keepPage({ cwd, exec, now = Date.now }: Io, n: IssueNumber, page: string): void {
  try {
    const main = mainCheckout(cwd, exec);
    if (main) writeLinks(main, 'roadmap', n, [{ label: 'roadmap page', href: page }], now());
  } catch {
    // The checkout refused the file: the push went through all the same.
  }
}

/** What a test hands `omni roadmap` beyond `main()`'s own. */
type RoadmapOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: () => number;
};

const USAGE = [
  'usage: omni roadmap check [<n>]',
  '       omni roadmap push <n>',
  '       omni roadmap answer <n> <question> "<answer>"',
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

/** Everything roadmap `n`'s push needs before it is sent, or the one line it stops with. */
function pushInputs(n: IssueNumber, io: Io): PushInputs | string {
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
  return { askUrl, client, body: roadmapPushBody({ repo, roadmap: read.roadmap, document: read.document, ...github }) };
}

/** The app's reply to roadmap `n`'s push, printed: its link and any note, exit 0; 1 with no roadmap in it. */
function reportPush(io: Io, n: IssueNumber, { askUrl, body }: PushInputs, reply: unknown): number {
  const roadmapId = field(reply, 'roadmapId');
  const { stdout, stderr } = io;
  if (typeof roadmapId !== 'string' || !roadmapId) return refuse(stderr, 'refused (no roadmap in the reply)');
  const how = field(reply, 'created') === true ? 'created' : 'updated';
  const page = `${askUrl.replace(/\/+$/, '')}/roadmaps/${roadmapId}`;
  println(stdout, `roadmap ${n}: ${how}, ${body.prds.length} PRD(s) — ${page}`);
  keepPage(io, n, page);
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

export const roadmap = {
  withoutContext: true,
  async run(args: string[], io: Io) {
    const [sub, ...rest] = args;
    if (sub === 'check') return checkCommand(rest, { ctx: loadContext(io.cwd, { exec: io.exec }), stdout: io.stdout });
    if (sub === 'push') return pushCommand(rest, io);
    if (sub === 'answer') return answerCommand(rest, io);
    throw usageError(USAGE);
  },
} satisfies FreeCommand;
