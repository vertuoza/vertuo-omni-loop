// `omni supervisor` (PRD omni-loop-34, s4): the Supervisor's seat. A runner starts the seat itself when its workspace
// placed it there (`omni runner`, ../../lib/runner/runner.ts); this command runs the same loop in the foreground for a
// runner that holds the seat (`--runner <id>`), and serves the seat's six tools to its think (`omni supervisor mcp`).
//
//   omni supervisor --runner <id> [--page <url>]       the seat's loop, until Ctrl-C or the seat leaves the runner
//   omni supervisor mcp --runner <id> [--page <url>]   the seat's tools, as an MCP server over stdio
//
// Both sign in as every kit command (OMNI_TOKEN, else omni signin), as the runner's owner. The Omni page is `--page`,
// else the `ask.url` of the repository it runs in. A test hands it `stdin`, `tokens`, `home`, `fetch`, `stop`, `sleep`
// and `think`.
import { homedir } from 'node:os';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { loadContext } from '../../lib/context.ts';
import { agentAccountOf, readAccounts } from '../../lib/runner/accounts.ts';
import { supervisorApi } from '../../lib/runner/api.ts';
import { runSeat } from '../../lib/runner/supervisor.ts';
import { serveSeatMcp } from '../../lib/runner/supervisor-mcp.ts';
import { claudeThinker } from '../../lib/runner/supervisor-think.ts';
import type { Think } from '../../lib/runner/supervisor-think.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';
import { interrupts } from './runner-follow.ts';

const USAGE = 'usage: omni supervisor --runner <id> [--page <url>] | omni supervisor mcp --runner <id> [--page <url>]';

type SupervisorOptions = {
  stdin?: HookStdin;
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  stop?: AbortSignal | undefined;
  sleep?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
  think?: Think | undefined;
};

type Io = FreeIo & SupervisorOptions;

/** The runner and the Omni page the flags name, or the line saying what is missing. */
function target(args: readonly string[], io: Io): { runner: string; page: string } | string {
  const { positional, flags } = parseArgs('supervisor', args, { values: ['runner', 'page'] });
  if (positional.length > 0 || flags.runner === undefined) throw usageError(USAGE);
  let page = flags.page ?? null;
  if (page === null) {
    try {
      page = loadContext(io.cwd, { exec: io.exec }).config.ask.url;
    } catch {
      page = null;
    }
  }
  return page === null ? 'no Omni page: give --page <url>, or run it in a repository whose config sets ask.url' : { runner: flags.runner, page };
}

const apiOf = (page: string, io: Io) =>
  supervisorApi({ askUrl: page, tokens: io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null }), fetch: io.fetch ?? globalThis.fetch });

/** The input as a stream of chunks: a text is one chunk, none is nothing. */
async function* chunksOf(stdin: HookStdin): AsyncGenerator<string | Uint8Array> {
  if (typeof stdin === 'string') {
    yield stdin;
    return;
  }
  if (stdin) yield* stdin;
}

/** `mcp`: the seat's six tools over stdio, for its think. */
async function mcp(args: string[], io: Io): Promise<number> {
  const asked = target(args, io);
  if (typeof asked === 'string') {
    println(io.stderr, `omni supervisor: ${asked}`);
    return 1;
  }
  const stdin = io.stdin === undefined ? process.stdin : io.stdin;
  await serveSeatMcp({ input: chunksOf(stdin), write: (line) => io.stdout.write(line), api: apiOf(asked.page, io), runner: asked.runner });
  return 0;
}

/** How the seat thinks from this terminal: Claude Code on the first Claude account of this machine's runner file. */
function thinkHere(io: Io, runner: string, page: string): Think | string {
  if (io.think) return io.think;
  if (!io.script) return 'the omni script is unknown';
  const home = io.home ?? homedir();
  const account = readAccounts({ home }).accounts.find((each) => each.agent === 'claude');
  if (account === undefined) return 'this machine has no Claude account';
  return claudeThinker({ omni: [process.execPath, io.script], runner, askUrl: page, home, account: agentAccountOf(account, home) });
}

/** The seat's loop in the foreground: 0 once stopped, 1 when the seat is not (or no longer) on that runner. */
async function seat(args: string[], io: Io): Promise<number> {
  const asked = target(args, io);
  if (typeof asked === 'string') {
    println(io.stderr, `omni supervisor: ${asked}`);
    return 1;
  }
  const stop = io.stop ? { signal: io.stop, release: () => undefined } : interrupts();
  try {
    const ended = await runSeat({
      api: apiOf(asked.page, io), runner: asked.runner, think: thinkHere(io, asked.runner, asked.page), halt: stop.signal, sleep: io.sleep,
      print: (line) => {
        println(io.stdout, line);
      },
    });
    if (ended === 'stopped') return 0;
    println(io.stderr, `omni supervisor: runner ${asked.runner} holds no Supervisor seat: an owner places it on the Runners page`);
    return 1;
  } finally {
    stop.release();
  }
}

export const supervisor: FreeCommand = {
  withoutContext: true,
  run(args: string[], io: Io): Promise<number> {
    const [first, ...rest] = args;
    return first === 'mcp' ? mcp(rest, io) : seat(args, io);
  },
};
