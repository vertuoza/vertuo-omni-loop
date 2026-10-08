// `omni now [--json] [--stdin] [--session <id>]` (PRD 1208's spec, "omni now"): what this Claude
// session is on now, its stage, the slices being built and what it is doing, for the status line,
// the `omni-hud` band and any agent. With `--json`, one document,
// `{ "headline", "work", "doing" }`; without it, the same in plain lines.
//
// The session's folder is the one Claude Code's status line JSON names when `--stdin` is given
// (`workspace.current_dir`, else `cwd`), else the folder it runs in. Its id is `--session <id>`, else
// the JSON's `session_id`, else `CLAUDE_CODE_SESSION_ID`. It reads git and files on this computer
// only: it never fetches, never calls GitHub or the Omni page, writes nothing, prints nothing on
// stderr and always exits 0, outside an installed repository too (the session on nothing). It runs
// before a context exists, like `statusline`; a test passes `stdin` (the text) and `now` (a clock in
// milliseconds). Any other argument is not read.
import { text } from 'node:stream/consumers';
import type { HookStdin } from '../../lib/ask/hook-input.ts';
import { nowLines } from '../../lib/now/now.ts';
import type { Now } from '../../lib/now/now.ts';
import { readNow } from '../../lib/now/read.ts';
import { parseInput } from '../../lib/statusline/input.ts';
import type { SessionInput } from '../../lib/statusline/input.ts';
import type { FreeCommand, FreeIo, Vars } from '../io.ts';

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
type NowOptions = { stdin?: HookStdin; now?: () => number };

/** Claude Code's status line JSON, read from stdin only with `--stdin`; `null` without it or when it cannot be read. */
async function sessionInput(args: readonly string[], stdin: HookStdin): Promise<SessionInput | null> {
  if (!args.includes(STDIN_FLAG)) return null;
  return parseInput(await stdinText(stdin).catch(() => ''));
}

/** The session's id: `--session <id>`, else the JSON's `session_id`, else `CLAUDE_CODE_SESSION_ID`, else `null`. */
const sessionOf = (args: readonly string[], input: SessionInput | null, vars: Vars): string | null =>
  valueOf(args, SESSION_FLAG) ?? input?.sessionId ?? vars.claudeSession?.id ?? null;

/** The answer, as one JSON document with `--json`, else as plain lines. */
const rendered = (args: readonly string[], answer: Now): string =>
  args.includes(JSON_FLAG) ? `${JSON.stringify(answer, null, 2)}\n` : `${nowLines(answer).join('\n')}\n`;

export const now = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, exec, vars, stdin = process.stdin, now: clock = Date.now }: FreeIo & NowOptions) {
    const input = await sessionInput(args, stdin);
    const answer = readNow({ cwd, folder: input?.currentDir ?? null, sessionId: sessionOf(args, input, vars), exec, now: clock() });
    try {
      stdout.write(rendered(args, answer));
    } catch {
      // A closed pipe: no one is left to read the answer.
    }
    return 0;
  },
} satisfies FreeCommand;
