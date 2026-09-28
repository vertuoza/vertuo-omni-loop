// `omni statusline` — the command Claude Code runs as its status line (PRD 324's spec): it reads the
// session's JSON on stdin and prints line 1 (the model, the context bar, the 5-hour usage, `ask on`)
// and, where the loop is installed, line 2: the PRD the session's branch names, with its slice, its
// stage and its open items (`PRD 7 bravo · s2 · outbox · 2 open items`), or
// `no PRD · /omni:brainstorm to start`.
//
// It never breaks Claude Code: it always exits 0 and prints at least one line, never writes to
// stderr, never fetches and never runs `gh`; what it cannot read leaves its part out. JSON that cannot
// be read prints `omni`; a reader that fails prints line 1 from the JSON alone. It runs before a context exists, like `init` and `ask`, so
// that no checkout, config or folder can turn it into an error; `main()` hands it
// `{ cwd, stdout, stderr, exec, env }`, and a test also passes `stdin` (the text), `now` (a clock in
// milliseconds) and `readFacts` (the reader). Its arguments are not read.
import { parseInput } from '../../lib/statusline/input.mjs';
import { readFacts as readCheckoutFacts } from '../../lib/statusline/facts.mjs';
import { renderLines, UNREADABLE_LINE } from '../../lib/statusline/render.mjs';

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
async function statusLines({ cwd, exec, env, stdin, now, readFacts }) {
  try {
    const input = parseInput(await readText(stdin).catch(() => ''));
    let facts = null;
    if (input) {
      try {
        facts = readFacts(input, { cwd, exec });
      } catch {
        facts = null;
      }
    }
    return renderLines({ input, facts, env: env ?? {}, now: now() });
  } catch {
    return [UNREADABLE_LINE];
  }
}

export const statusline = {
  withoutContext: true,
  async run(_args, { cwd, stdout, exec, env, stdin = process.stdin, now = Date.now, readFacts = readCheckoutFacts }) {
    const lines = await statusLines({ cwd, exec, env, stdin, now, readFacts });
    try {
      stdout.write(`${lines.join('\n')}\n`);
    } catch {
      // A closed pipe: Claude Code stopped listening, and there is no one left to tell.
    }
    return 0;
  },
};
