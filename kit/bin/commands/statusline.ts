// @ts-nocheck
// `omni statusline` — the command Claude Code runs as its status line (PRD 324's spec): it reads the
// session's JSON on stdin and prints line 1 (the model, the context bar, the 5-hour usage, `ask on`)
// and, where the loop is installed, line 2: the PRD the session's branch names, else the one the
// session last worked on (the record its `session_id` names, written by the commands that name a
// PRD), with its slice, its stage, the wave and the slices of its board in the outbox, and its open
// items (`PRD 7 bravo · s2 · outbox · wave 2 of 4 · 3/5 slices merged, 1 stuck · 2 open items`), or
// `no PRD · /omni:brainstorm to start`.
//
// It never breaks Claude Code: it always exits 0 and prints at least one line, never writes to
// stderr, never fetches, never runs `gh` and writes no file; what it cannot read leaves its part out.
// JSON that cannot be read prints `omni`; a reader that fails prints line 1 from the JSON alone. The
// board comes from a file in the main checkout (`board-cache.mjs`): when it is missing or a minute
// old, the status line starts its refresh, detached, and never waits for it. It runs before a
// context exists, like `init` and `ask`, so that no checkout, config or folder can turn it into an
// error; `main()` hands it `{ cwd, stdout, stderr, exec, env }`, and a test also passes `stdin` (the
// text), `now` (a clock in milliseconds), `readFacts` (the reader) and `spawn` (what starts the
// refresh). Any argument but `--refresh` is not read.
//
// `omni statusline --refresh <n>` is that refresh, the background half: it takes PRD `<n>`'s lock
// (another refresh holds it: exit 0, nothing written), builds the board exactly as `omni board <n>`
// does, in its own folder (the session's), writes it to the main checkout's board file, and removes
// the lock. Any failure (no `gh`, offline, no plan) is written as the error entry. It prints nothing
// and always exits 0: no one reads its output. Each call it runs is cut off after a minute, so that a
// hung `gh` never outlives the lock by much.
import { spawn as spawnProcess } from 'node:child_process';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { refreshBoard } from '../../lib/statusline/board-cache.ts';
import { readFacts as readCheckoutFacts } from '../../lib/statusline/facts.ts';
import { parseInput } from '../../lib/statusline/input.ts';
import { renderLines, UNREADABLE_LINE } from '../../lib/statusline/render.ts';
import { positiveInt } from '../args.ts';
import { buildBoard } from './board.ts';

const REFRESH_FLAG = '--refresh';
/** How long one call of the refresh may run. */
const CALL_TIMEOUT_MS = 60 * 1000;

/** The text on stdin: `stdin` itself when a test passes a string, else the stream read to its end; a terminal is never read. */
async function readText(stdin) {
  if (typeof stdin === 'string') return stdin;
  if (!stdin || stdin.isTTY) return '';
  stdin.setEncoding?.('utf8');
  let text = '';
  for await (const chunk of stdin) text += chunk;
  return text;
}

/** The lines to print, never throwing: line 1 from the JSON alone when the reader fails, `omni` when anything else does. */
async function statusLines({ cwd, exec, env, stdin, now, readFacts, spawn }) {
  try {
    const input = parseInput(await readText(stdin).catch(() => ''));
    const instant = now();
    let facts = null;
    if (input) {
      try {
        facts = readFacts(input, { cwd, exec, now: instant, spawn, env });
      } catch {
        facts = null;
      }
    }
    return renderLines({ input, facts, env: env ?? {}, now: instant });
  } catch {
    return [UNREADABLE_LINE];
  }
}

/** `value` as a PRD number, or `null`. */
function prdNumber(value) {
  try {
    return positiveInt('statusline', '<n>', value);
  } catch {
    return null;
  }
}

/** The refresh of PRD `value`'s board: never throws, never prints. */
function refresh(value, { cwd, exec, env, now }) {
  const prd = prdNumber(value);
  if (prd === null) return;
  try {
    const root = mainCheckout(cwd, exec);
    if (!root) return;
    const timed = (file, args, options) => exec(file, args, { ...options, timeout: CALL_TIMEOUT_MS });
    const instant = now();
    const build = () => buildBoard(prd, { ctx: loadContext(cwd, { exec: timed }), exec: timed, env, now: instant }).result.slices;
    refreshBoard({ root, prd, now: instant, build });
  } catch {
    // Nowhere to write, or the disk refused: the next render starts another.
  }
}

export const statusline = {
  withoutContext: true,
  async run(args, { cwd, stdout, exec, env, stdin = process.stdin, now = Date.now, readFacts = readCheckoutFacts, spawn = spawnProcess }) {
    if (args[0] === REFRESH_FLAG) {
      refresh(args[1], { cwd, exec, env, now });
      return 0;
    }
    const lines = await statusLines({ cwd, exec, env, stdin, now, readFacts, spawn });
    try {
      stdout.write(`${lines.join('\n')}\n`);
    } catch {
      // A closed pipe: Claude Code stopped listening, and there is no one left to tell.
    }
    return 0;
  },
};
