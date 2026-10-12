// `omni setup-token [--name <name>] [--days 30|90|365] [--device | --loopback]` (PRD 1628, spec
// section 4; PRD 1660): makes a kit token from the terminal, for a cloud session's `OMNI_TOKEN`, by
// the sign-in round trip `omni signin` runs (`./signin.ts`) with `purpose=token`, and the same choice
// of flow. It prints the token, its expiry and the line to paste it by, and keeps it nowhere: not in
// `~/.config/omni/credentials.json`, not in `.omni-loop/local/`, not in a log.
//
// - The loopback flow (on a laptop, or with `--loopback`) starts a one-shot listener on 127.0.0.1,
//   opens `<ask.url>/ask/signin?purpose=token&name=<name>&days=<days>&port=<p>&state=<s>` in the
//   browser, and catches the token the page sends back once (`../../lib/ask/loopback.ts`), with its
//   expiry. It issues a device request for the same token too and prints it under its own link as
//   the fallback, `Browser didn't open, or it's on another machine? <link>  (code <c>)`, then
//   finishes on whichever comes back first, the other closed (`../../lib/ask/race.ts`). When the
//   request cannot be issued, the line is left out and the loopback runs alone.
// - The device flow (in a remote session, on Linux with no display, or with `--device`; `chooseFlow`
//   in `../../lib/ask/device.ts`) prints `Sign in at <ask.url>/ask/device?user_code=<c>` and
//   `Check that the page shows <c>. Waiting (10 min)…`, opens no browser, and polls the page until
//   the person approves the request in any browser, which hands the token over once. Refused,
//   expired or unreachable ends with one line, exit 1. A page with no device sign-in (404, or 503)
//   says so on stderr and runs the loopback.
//
// `--name` defaults to `terminal <yyyy-mm-dd>` (today, in UTC, as the page names it); `--days` to 90,
// and only 30, 90 or 365 are taken. The workspace is the one the page picks, in both flows. It never
// reads `OMNI_TOKEN`: one already set does not stop a new token being made. With no `ask.url` it
// exits 1 with one line; a token that does not come back within the wait is one line too, exit 1. A
// test hands it `openBrowser`, `fetch`, `waitMs`, `now` and `platform`.
import { randomBytes } from 'node:crypto';
import type { Fetch } from '../../lib/ask/client.ts';
import { askEndpoint } from '../../lib/ask/credentials.ts';
import { chooseFlow, DeviceError, startDevice } from '../../lib/ask/device.ts';
import type { Device, DeviceReason } from '../../lib/ask/device.ts';
import { LOOPBACK_WAIT_MS, LoopbackError, startTokenLoopback } from '../../lib/ask/loopback.ts';
import type { MadeToken } from '../../lib/ask/loopback.ts';
import { firstOf } from '../../lib/ask/race.ts';
import type { Contender } from '../../lib/ask/race.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';
import { ASK_URL_UNSET, openInBrowser } from './signin.ts';

const USAGE = 'usage: omni setup-token [--name <name>] [--days 30|90|365] [--device | --loopback]';

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
  fetch?: Fetch;
  waitMs?: number;
  now?: (() => Date) | undefined;
  platform?: NodeJS.Platform;
};

/** What the device flow says when the page has no device sign-in, before it runs the loopback: the
 * line `omni signin` prints. */
const NO_DEVICE_SIGN_IN = 'this Omni page has no device sign-in yet: using the browser on this machine';

/** The line after `omni setup-token: ` each way a device request ends: `omni signin`'s lines, naming
 * this command to run again. */
const DEVICE_ENDINGS: Readonly<Record<Exclude<DeviceReason, 'unavailable'>, string>> = {
  denied: 'the sign-in was refused in the browser',
  expired: 'the sign-in link expired: run omni setup-token again',
  unreachable: 'unreachable',
  closed: 'the sign-in was stopped before it came back',
};

/** The line after `omni setup-token: ` for an error that ends the run; `null` for any other error. A
 * device request the page has no sign-in for only ever ends the race as unreachable. */
function endingOf(error: unknown): string | null {
  if (error instanceof DeviceError) return DEVICE_ENDINGS[error.reason === 'unavailable' ? 'unreachable' : error.reason];
  if (error instanceof LoopbackError) return error.message;
  return null;
}

/** The kit token, and its expiry, an approved token request hands over; one without both ends
 * `unreachable`, as an answer the kit cannot read. */
async function tokenOf(device: Device): Promise<MadeToken> {
  const approval = await device.poll();
  if (!('token' in approval) || approval.expiresAt === null || Number.isNaN(Date.parse(approval.expiresAt))) throw new DeviceError('unreachable');
  return { token: approval.token, expiresAt: approval.expiresAt };
}

/** What making a token needs, whichever flow brings it back. */
type TokenRun = Required<Pick<SetupTokenOptions, 'openBrowser' | 'fetch' | 'waitMs'>> & {
  askUrl: string;
  name: string;
  days: string;
  stdout: FreeIo['stdout'];
  stderr: FreeIo['stderr'];
};

/** Issues a device request for the token: its name, its days, and the workspace the page picks. */
function startTokenDevice({ askUrl, name, days, fetch }: TokenRun): Promise<Device> {
  return startDevice({ askUrl, purpose: 'token', name, days: Number(days), workspace: null, fetch });
}

/** Prints the token, its expiry and the line to paste it by; keeps it nowhere. */
function printToken({ stdout }: TokenRun, made: MadeToken): number {
  println(stdout, made.token);
  println(stdout, `It expires on ${new Date(made.expiresAt).toISOString().slice(0, 10)}.`);
  println(stdout, `Paste it as OMNI_TOKEN=${made.token} in your cloud environment's variables.`);
  return 0;
}

/** 1, with the line `error` ends the run on, on stderr; any other error is thrown again. */
function endingLine({ stderr }: TokenRun, error: unknown): number {
  const ending = endingOf(error);
  if (ending === null) throw error;
  println(stderr, `omni setup-token: ${ending}`);
  return 1;
}

/** The device request the loopback offers as its fallback; `null` when the page cannot issue one. */
async function fallbackDevice(run: TokenRun): Promise<Device | null> {
  try {
    return await startTokenDevice(run);
  } catch (error) {
    if (error instanceof DeviceError) return null;
    throw error;
  }
}

/** Makes the token by the browser coming back to a listener on 127.0.0.1, or by the fallback device
 * request, whichever comes back first; the other is closed. */
async function tokenByLoopback(run: TokenRun): Promise<number> {
  const { askUrl, name, days, stdout, openBrowser, waitMs } = run;
  const state = randomBytes(32).toString('base64url');
  const listener = await startTokenLoopback({ state, timeoutMs: waitMs });
  const issuing = fallbackDevice(run);
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
    const contenders: Contender<MadeToken>[] = [{ result: listener.token, close: () => listener.close() }];
    const device = await issuing;
    if (device) {
      println(stdout, `Browser didn't open, or it's on another machine? ${device.url}  (code ${device.userCode})`);
      contenders.push({ result: tokenOf(device), close: () => device.close() });
    }
    return printToken(run, await firstOf(contenders));
  } catch (error) {
    return endingLine(run, error);
  } finally {
    await listener.close();
    await (await issuing)?.close();
  }
}

/** Makes the token by a device request the person approves in any browser; `null` when the page has
 * no device sign-in. */
async function tokenByDevice(run: TokenRun): Promise<number | null> {
  const { stdout } = run;
  try {
    const device = await startTokenDevice(run);
    try {
      println(stdout, `Sign in at ${device.url}`);
      println(stdout, `Check that the page shows ${device.userCode}. Waiting (${Math.max(1, Math.round(device.waitMs / 60_000))} min)…`);
      return printToken(run, await tokenOf(device));
    } finally {
      await device.close();
    }
  } catch (error) {
    if (error instanceof DeviceError && error.reason === 'unavailable') return null;
    return endingLine(run, error);
  }
}

export const setupToken = {
  withoutContext: true,
  async run(
    args: string[],
    {
      cwd, stdout, stderr, exec, vars, openBrowser = openInBrowser, fetch = globalThis.fetch, waitMs = LOOPBACK_WAIT_MS, now = () => new Date(), platform = process.platform,
    }: FreeIo & SetupTokenOptions,
  ) {
    const { positional, flags } = parseArgs('setup-token', args, { values: ['name', 'days'], booleans: ['device', 'loopback'] });
    if (positional.length > 0 || (flags.device && flags.loopback)) throw usageError(USAGE);
    const name = nameOf(flags.name, now());
    const days = daysOf(flags.days);
    const askUrl = loadContext(cwd, { exec }).config.ask.url;
    if (!askUrl) {
      println(stderr, ASK_URL_UNSET);
      return 1;
    }
    const run: TokenRun = { askUrl, name, days, stdout, stderr, openBrowser, fetch, waitMs };
    const forced = flags.device ? 'device' : flags.loopback ? 'loopback' : null;
    if (chooseFlow(vars.session, platform, forced) === 'device') {
      const ended = await tokenByDevice(run);
      if (ended !== null) return ended;
      println(stderr, NO_DEVICE_SIGN_IN);
    }
    return tokenByLoopback(run);
  },
} satisfies FreeCommand;
