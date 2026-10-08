// `omni idea add '<title>' --pitch '<pitch>' [--lane now|next|later] | omni idea list [--json]` — this
// repository's ideas board on the Omni page (PRD 1246, s2), for a member of its workspace.
//
// - `add` checks the idea (`../../lib/idea/idea.ts`: a title of 1 to 120 characters, a pitch of 1 to
//   600, a lane of now, next or later, later when none is given), sends it, and prints the board's link.
// - `list` prints the board's ideas lane by lane, Now, Next then Later, each with its votes and its PRD
//   when it has one; `--json` prints the same board as JSON.
//
// Both go through the terminal's sign-in (`omni signin`) and the switch and workspace gate `omni dossier`
// uses: the calls go to `ask.url`, and the app answers by the caller's workspace membership. They never
// hold up whoever runs them: no sign-in, dossiers off, the app unreachable or its refusal is one line and
// exit 0. Exit 2 is an argument it cannot run: a bad lane, a title or pitch too long, a verb it does not
// know.
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { boardOf, checkIdea, listLines, type NewIdea } from '../../lib/idea/idea.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';

/** What a test hands `omni idea` beyond `main()`'s own. */
type IdeaOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };

const USAGE = "usage: omni idea add '<title>' --pitch '<pitch>' [--lane now|next|later] | omni idea list [--json]";
const NO_SIGN_IN = 'no sign-in (omni signin)';

/** The one line a failed call is reported with, as `omni dossier` words it. */
function skipLine(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.reason ? `refused (${error.status}): ${error.reason}` : `refused (${error.status})`;
}

/** Runs one call; a failure is its one line on stderr, and null. */
async function attempt(stderr: Out, call: () => Promise<unknown>): Promise<{ reply: unknown } | null> {
  try {
    return { reply: await call() };
  } catch (error) {
    println(stderr, skipLine(error));
    return null;
  }
}

/** What `omni idea` was asked: an idea to add, or the board to list, as text or as JSON. */
type Asked = { verb: 'add'; idea: NewIdea } | { verb: 'list'; json: boolean };
type IdeaFlags = { pitch?: string; lane?: string; json?: true };

/** The arguments of `list`: nothing but `--json`. */
function listArgs(rest: readonly string[], flags: IdeaFlags): Asked {
  if (rest.length || flags.pitch !== undefined || flags.lane !== undefined) throw usageError(USAGE);
  return { verb: 'list', json: flags.json === true };
}

/** The arguments of `add`: one title and its pitch, a lane maybe, checked before anything is sent. */
function addArgs(rest: readonly string[], flags: IdeaFlags): Asked {
  const [title] = rest;
  if (title === undefined || rest.length !== 1 || flags.pitch === undefined || flags.json) throw usageError(USAGE);
  const checked = checkIdea({ title, pitch: flags.pitch, lane: flags.lane });
  if (!checked.ok) throw usageError(`omni idea add: ${checked.problem}`);
  return { verb: 'add', idea: checked.idea };
}

/** The arguments, checked before anything is read or sent. */
function readArgs(args: string[]): Asked {
  const { positional, flags } = parseArgs('idea', args, { values: ['pitch', 'lane'], booleans: ['json'] });
  const [verb = '', ...rest] = positional;
  if (verb === 'list') return listArgs(rest, flags);
  if (verb === 'add') return addArgs(rest, flags);
  throw usageError(USAGE);
}

type Client = NonNullable<ReturnType<typeof signedInClient>>;
type Streams = { stdout: Out; stderr: Out };

/** The signed-in client and this repository, or null once the one line saying why not is printed. */
function connect({ cwd, exec, stderr, tokens, home, fetch, callMs }: Pick<FreeIo, 'cwd' | 'exec' | 'stderr'> & IdeaOptions & { fetch: Fetch }):
  { client: Client; repo: string } | null {
  const ctx = loadContext(cwd, { exec });
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) {
    println(stderr, `off (${toggle.reason})`);
    return null;
  }
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni idea: no repository slug — set repo.slug in the config.');
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  if (!client) {
    println(stderr, NO_SIGN_IN);
    return null;
  }
  return { client, repo };
}

/** Adds the idea, and prints the board's link. */
async function add({ client, repo }: { client: Client; repo: string }, idea: NewIdea, { stdout, stderr }: Streams): Promise<void> {
  const sent = await attempt(stderr, () => client.addIdea({ repo, ...idea }));
  if (!sent) return;
  const url = field(sent.reply, 'url');
  if (typeof url === 'string' && url) println(stdout, url);
  else println(stderr, 'refused (no board in the reply)');
}

/** Prints the board lane by lane, or as JSON. */
async function list({ client, repo }: { client: Client; repo: string }, json: boolean, { stdout, stderr }: Streams): Promise<void> {
  const read = await attempt(stderr, () => client.listIdeas(repo));
  if (!read) return;
  const board = boardOf(read.reply);
  if (!board) println(stderr, 'refused (no board in the reply)');
  else if (json) println(stdout, JSON.stringify(board, null, 2));
  else for (const line of listLines(board)) println(stdout, line);
}

export const idea = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs }: FreeIo & IdeaOptions) {
    const asked = readArgs(args);
    const connected = connect({ cwd, exec, stderr, tokens, home, fetch, callMs });
    if (!connected) return 0;
    if (asked.verb === 'add') await add(connected, asked.idea, { stdout, stderr });
    else await list(connected, asked.json, { stdout, stderr });
    return 0;
  },
} satisfies FreeCommand;
