// `omni setup-token [--name <name>] [--days 30|90|365]` (PRD 1628, spec section 4): makes a kit token
// from the terminal, for a cloud session's `OMNI_TOKEN`, by the sign-in round trip `omni signin` runs
// (`./signin.ts`) with `purpose=token`. It starts a one-shot listener on 127.0.0.1, opens
// `<ask.url>/ask/signin?purpose=token&name=<name>&days=<days>&port=<p>&state=<s>` in the browser, and
// catches the token the page sends back once (`../../lib/ask/loopback.ts`), with its expiry. It prints
// the token, its expiry and the line to paste it by, and keeps it nowhere: not in
// `~/.config/omni/credentials.json`, not in `.omni-loop/local/`, not in a log.
//
// `--name` defaults to `terminal <yyyy-mm-dd>` (today, in UTC, as the page names it); `--days` to 90,
// and only 30, 90 or 365 are taken. It never reads `OMNI_TOKEN`: one already set does not stop a new
// token being made. With no `ask.url` it exits 1 with one line; a token that does not come back
// within the wait is one line too, exit 1. A test hands it `openBrowser`, `waitMs` and `now`.
import { randomBytes } from 'node:crypto';
import { askEndpoint } from '../../lib/ask/credentials.ts';
import { LOOPBACK_WAIT_MS, LoopbackError, startTokenLoopback } from '../../lib/ask/loopback.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';
import { ASK_URL_UNSET, openInBrowser } from './signin.ts';

const USAGE = 'usage: omni setup-token [--name <name>] [--days 30|90|365]';
/** The expiries a kit token may have, in days, as the page takes them. */
const DAYS = ['30', '90', '365'];
const DEFAULT_DAYS = '90';
const NAME_MAX = 40;

/** The token's name: `--name` trimmed, 1 to 40 characters with no control character, or the default. */
function nameOf(given: string | undefined, today: Date): string {
  if (given === undefined) return `terminal ${today.toISOString().slice(0, 10)}`;
  const name = given.trim();
  const control = Array.from(name).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (name === '' || name.length > NAME_MAX || control) throw usageError(`omni setup-token: --name must be 1 to ${NAME_MAX} characters on one line.`);
  return name;
}

/** `--days` as given, when it is one of 30, 90 or 365; 90 when not given. */
function daysOf(given: string | undefined): string {
  if (given === undefined) return DEFAULT_DAYS;
  if (!DAYS.includes(given)) throw usageError(`omni setup-token: --days must be 30, 90 or 365, got "${given}".`);
  return given;
}

/** What a test hands `omni setup-token` beyond `main()`'s own. */
type SetupTokenOptions = {
  openBrowser?: (url: string) => unknown;
  waitMs?: number;
  now?: (() => Date) | undefined;
};

export const setupToken = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, stderr, exec, openBrowser = openInBrowser, waitMs = LOOPBACK_WAIT_MS, now = () => new Date() }: FreeIo & SetupTokenOptions,
  ) {
    const { positional, flags } = parseArgs('setup-token', args, { values: ['name', 'days'] });
    if (positional.length > 0) throw usageError(USAGE);
    const name = nameOf(flags.name, now());
    const days = daysOf(flags.days);
    const askUrl = loadContext(cwd, { exec }).config.ask.url;
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const state = randomBytes(32).toString('base64url');
    const listener = await startTokenLoopback({ state, timeoutMs: waitMs });
    try {
      const page = new URL(askEndpoint(askUrl, '/ask/signin'));
      page.searchParams.set('purpose', 'token');
      page.searchParams.set('name', name);
      page.searchParams.set('days', days);
      page.searchParams.set('port', String(listener.port));
      page.searchParams.set('state', state);
      println(stdout, `Make the token in your browser: ${page}`);
      try {
        await openBrowser(page.toString());
      } catch {
        // No browser here: the link above opens by hand, and the listener waits all the same.
      }
      const made = await listener.token;
      println(stdout, made.token);
      println(stdout, `It expires on ${new Date(made.expiresAt).toISOString().slice(0, 10)}.`);
      println(stdout, `Paste it as OMNI_TOKEN=${made.token} in your cloud environment's variables.`);
      return 0;
    } catch (error) {
      if (!(error instanceof LoopbackError)) throw error;
      println(stderr, `omni setup-token: ${error.message}`);
      return 1;
    } finally {
      await listener.close();
    }
  },
} satisfies FreeCommand;
