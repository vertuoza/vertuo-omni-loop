// `omni now [--json] [--stdin] [--session <id>]` (PRD 1208's spec, "omni now"): what this Claude
// session is on now, its stage, the slices being built and what it is doing, for the status line,
// the `omni-hud` band and any agent. With `--json`, one document,
// `{ "headline", "work", "doing" }`; without it, the same in plain lines.
//
// The session's folder is the one Claude Code's status line JSON names when `--stdin` is given
// (`workspace.current_dir`, else `cwd`), else the folder it runs in. Its id is `--session <id>`, else
// the JSON's `session_id`, else `OMNI_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`, else the id
// `omni dossier open` stored for the checkout (PRD 1739). It reads git and files on this computer
// only, save one thing (PRD 2251): while signed in, the runners' free slots come from the Omni page, cached 30
// seconds in the local folder (`../../lib/now/runner.ts`), the cache being all it writes. It never fetches,
// never calls GitHub, prints nothing on
// stderr and always exits 0, outside an installed repository too (the session on nothing). It runs
// before a context exists, like `statusline`; a test passes `stdin` (the text) and `now` (a clock in
// milliseconds). Any other argument is not read.
import { text } from 'node:stream/consumers';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { loadContext } from '../../lib/context.ts';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { sessionIdOf } from '../../lib/dossier/session.ts';
import { nowLines, withRunners } from '../../lib/now/now.ts';
import type { Now } from '../../lib/now/now.ts';
import { readNow } from '../../lib/now/read.ts';
import { readFollow, readRunners } from '../../lib/now/runner.ts';
import { parseInput } from '../../lib/statusline/input.ts';
import type { SessionInput } from '../../lib/statusline/input.ts';
import type { Exec, FreeCommand, FreeIo, Vars } from '../io.ts';

const JSON_FLAG = '--json';
const STDIN_FLAG = '--stdin';
const SESSION_FLAG = '--session';

/** The text on stdin: `stdin` itself when a test passes a string, else the stream read to its end;
 * a terminal, or no stdin, reads as no text. */
async function stdinText(stdin: HookStdin): Promise<string> {
  if (typeof stdin === 'string') return stdin;
  return stdin && !stdin.isTTY ? text(stdin) : '';
}

/** The value after `flag` in `args`, when there is one that is not itself a flag. */
function valueOf(args: readonly string[], flag: string): string | null {
  if (!args.includes(flag)) return null;
  const value = args[args.indexOf(flag) + 1];
  return value !== undefined && !value.startsWith('--') ? value : null;
}

/** What a test hands `omni now` beyond `main()`'s own. */
type NowOptions = { stdin?: HookStdin; now?: () => number; tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch };

/** `answer` with the runner rows: the slots free, read from the page while signed in, and the followed job's last milestone. Never throws. */
async function withRunnerRows(answer: Now, { folder, io, at }: { folder: string; io: FreeIo & NowOptions; at: number }): Promise<Now> {
  try {
    const ctx = loadContext(folder, { exec: io.exec });
    const { slug } = ctx.config.repo;
    const askUrl = ctx.config.ask.url;
    const tokens = io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });
    const runners = slug && askUrl ? await readRunners({ root: ctx.root, repo: slug, askUrl, tokens, fetch: io.fetch ?? globalThis.fetch, now: at }) : undefined;
    return withRunners(answer, runners, readFollow(ctx.root));
  } catch {
    return answer;
  }
}

/** Claude Code's status line JSON, read from stdin only with `--stdin`; `null` without it or when it cannot be read. */
async function sessionInput(args: readonly string[], stdin: HookStdin): Promise<SessionInput | null> {
  if (!args.includes(STDIN_FLAG)) return null;
  return parseInput(await stdinText(stdin).catch(() => ''));
}

/**
 * The session's id: `--session <id>`, else the JSON's `session_id`, else the agent session the
 * variables name, else the id stored in the main checkout of `folder`, else `null`. Never throws.
 */
function sessionOf(args: readonly string[], input: SessionInput | null, { vars, folder, exec }: { vars: Vars; folder: string; exec: Exec }): string | null {
  const given = valueOf(args, SESSION_FLAG) ?? input?.sessionId ?? vars.agentSession?.id ?? null;
  if (given !== null) return given;
  try {
    return sessionIdOf(null, mainCheckout(folder, exec));
  } catch {
    return null;
  }
}

/** The answer, as one JSON document with `--json`, else as plain lines. */
const rendered = (args: readonly string[], answer: Now): string =>
  args.includes(JSON_FLAG) ? `${JSON.stringify(answer, null, 2)}\n` : `${nowLines(answer).join('\n')}\n`;

export const now = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & NowOptions) {
    const { cwd, stdout, exec, vars, stdin = process.stdin, now: clock = Date.now } = io;
    const input = await sessionInput(args, stdin);
    const read = readNow({ cwd, folder: input?.currentDir ?? null, sessionId: sessionOf(args, input, { vars, folder: input?.currentDir ?? cwd, exec }), exec, now: clock() });
    const answer = args.includes(JSON_FLAG) ? await withRunnerRows(read, { folder: input?.currentDir ?? cwd, io, at: clock() }) : read;
    try {
      stdout.write(rendered(args, answer));
    } catch {
      // A closed pipe: no one is left to read the answer.
    }
    return 0;
  },
} satisfies FreeCommand;
