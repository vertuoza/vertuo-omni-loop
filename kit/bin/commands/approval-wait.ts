// `omni wait approval <n> [--timeout <minutes>]` (PRD 1322, s4): asks PRD n's approvers on the Omni
// page, prints the waiting line and follows the approval as it streams, until it lands (exit 0), the
// sign-in is refused or missing, the page refuses the request, or `--timeout` minutes pass (60 by
// default; exit 1). `kit/lib/approval/wait.ts` holds the lines and the waiting file the HUD reads.
//
// It runs before a context exists, like `approval`, so that a test can hand it `tokens` (the token
// store), `home` (where the real one lives), `fetch`, `callMs`, and the wait's `sleep`, `now`,
// `idleMs` and `deadline` (the signal the timeout aborts, from the minutes); it loads the context itself.
import { signedInClient } from '../../lib/ask/credentials.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { SIGNED_OUT_LINE, waitForApproval } from '../../lib/approval/wait.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, positiveInt, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

const USAGE = 'usage: omni wait approval <n> [--timeout <minutes>]';
const DEFAULT_TIMEOUT_MINUTES = 60;

/** What a test hands `omni wait` beyond `main()`'s own. */
type WaitCommandOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  sleep?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined;
  now?: (() => Date) | undefined;
  idleMs?: number | undefined;
  deadline?: ((ms: number) => AbortSignal) | undefined;
};

export const wait = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & WaitCommandOptions) {
    const { cwd, stdout, exec, tokens, home, fetch = globalThis.fetch, callMs, sleep, now, idleMs, deadline = (ms: number) => AbortSignal.timeout(ms) } = io;
    const { positional, flags } = parseArgs('wait', args, { values: ['timeout'] });
    if (positional.length !== 2 || positional[0] !== 'approval') throw usageError(USAGE);
    const prd = prdArg('wait', '<n>', positional[1]);
    const timeoutMinutes = flags.timeout === undefined ? DEFAULT_TIMEOUT_MINUTES : positiveInt('wait', '--timeout', flags.timeout);
    const ctx = loadContext(cwd, { exec });
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError('omni wait: no repository slug — set repo.slug in the config.');
    if (!ctx.layout.whereIs(prd)) {
      println(io.stderr, `omni wait: PRD ${Number(prd)} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    const askUrl = ctx.config.ask.url;
    if (!askUrl) {
      println(stdout, 'no Omni page is set here (ask.url) · held');
      return 1;
    }
    const client = signedInClient({ askUrl, tokens, home, fetch, callMs });
    if (!client) {
      println(stdout, SIGNED_OUT_LINE);
      return 1;
    }
    const { code } = await waitForApproval({
      ctx, prd, repo, client, timeoutMinutes, sleep, now, idleMs,
      print: (line) => { println(stdout, line); },
      deadline: deadline(timeoutMinutes * 60_000),
    });
    return code;
  },
} satisfies FreeCommand;
