// `omni pitch start|check|render|studio` make a pitch on the person's computer (`./pitch-make.ts`);
// `omni pitch push <n> <dir>` — sends a pitch run `/omni:pitch` made of shipped PRD n to its dossier on
// the Omni page (PRD 859's spec, "Push"), and prints the Pitch tab's link, then the GIF's stable link (the
// one that opens without signing in) on a second line.
//
// It reads `<dir>/pitch.json` and the five files every pitch holds (`../../lib/pitch/push-run.ts`),
// refusing before anything is sent what the app would refuse: a file of the five missing, an audience,
// look, commit or word out of shape is `refused (400): <why>`, a file over 50 MB `refused (413): <why>`.
// Then it asks for a signed upload link per file, puts each file to its own, and registers the run
// (`../../lib/pitch/push.ts`). It never retries.
//
// It never blocks the skill that runs it, and speaks as `omni proof push` does: anything that stops it is
// exit 1 with one line, every file kept — `none` (PRD n has no dossier), `off`,
// `no sign-in (omni signin)`, `unreachable`, `not shipped` (the PRD is not shipped or retro),
// `refused (<status>)` or `refused (403): <the server's reason>`. Exit 2 is the kit not installed here,
// a config that does not read, a folder without pitch.json, or arguments it cannot run.
//
// It runs before a context exists, like `proof`, so that a test can hand it `tokens`, `home`, `fetch`
// and `callMs`; it loads the context itself.
import { isAbsolute, resolve } from 'node:path';
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import { isOneOf, keysOf } from '../../lib/narrow.ts';
import { PitchReplyError, pushPitch } from '../../lib/pitch/push.ts';
import { PITCH_RUN_FILE, PitchRunRefused, readPitchRun } from '../../lib/pitch/push-run.ts';
import type { PitchRun } from '../../lib/pitch/push-run.ts';
import type { Launch } from '../../lib/pitch/providers/types.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { PITCH_MAKERS } from './pitch-make.ts';

/** What a test hands `omni pitch` beyond `main()`'s own. */
type PitchOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: (() => Date) | undefined;
  launch?: Launch | undefined;
  openBrowser?: ((url: string) => unknown) | undefined;
  studioUntil?: ((url: string) => Promise<void>) | undefined;
};

/** What a call is handed: the streams and the options. */
type CallIo = { stdout: Out; stderr: Out; tokens: TokenStore | undefined; home: string | undefined; fetch: Fetch; callMs: number | undefined };

const USAGE = 'usage: omni pitch push <n> <dir>';
const VERBS = 'usage: omni pitch start|check|render|studio|push …';
const NO_SIGN_IN = 'no sign-in (omni signin)';

/** The one line a failed call is reported with, as `omni proof push` words it. */
function skipLine(error: unknown): string {
  if (error instanceof PitchReplyError) return `refused (${error.message})`;
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  if (error.status === 404) return 'none';
  if (error.status === 422) return 'not shipped';
  return error.status === 403 && error.reason ? `refused (403): ${error.reason}` : `refused (${error.status})`;
}

/** What `omni pitch push <n> <dir>` names, or a usage error. */
function argsOf(args: string[]): { prd: PrdNumber; dir: string } {
  const { positional } = parseArgs('pitch', args);
  const [verb, first, second, ...rest] = positional;
  if (verb !== 'push' || second === undefined || rest.length) throw usageError(USAGE);
  return { prd: prdArg('pitch push', '<n>', first), dir: second };
}

/** The run in `dir`, or the one line a local refusal is reported with. */
function localRun(cwd: string, dir: string, prd: PrdNumber): { line: string; run?: undefined } | { run: PitchRun; line?: undefined } {
  const folder = isAbsolute(dir) ? dir : resolve(cwd, dir);
  let run;
  try {
    run = readPitchRun(folder, prd);
  } catch (error) {
    if (!(error instanceof PitchRunRefused)) throw error;
    return { line: `refused (${error.status}): ${error.message}` };
  }
  if (!run) throw usageError(`omni pitch push: ${dir} holds no ${PITCH_RUN_FILE}.`);
  return { run };
}

/** Sends the run and prints its links, or the one line that stopped it; the exit code. */
async function send(
  { askUrl, repo, prd, run }: { askUrl: string; repo: string; prd: PrdNumber; run: PitchRun },
  { stdout, stderr, tokens, home, fetch, callMs }: CallIo,
): Promise<number> {
  const client = signedInClient({ askUrl, tokens, home, fetch, callMs });
  if (!client) {
    println(stderr, NO_SIGN_IN);
    return 1;
  }
  let pushed;
  try {
    pushed = await pushPitch({ client, repo, prd, run });
  } catch (error) {
    println(stderr, skipLine(error));
    return 1;
  }
  println(stdout, pushed.tab);
  println(stdout, pushed.gif);
  return 0;
}

/** The run to send, or the one line that stops the push before any call: `off`, or a local refusal. */
function pushable(
  ctx: Context,
  cwd: string,
  dir: string,
  prd: PrdNumber,
): { line: string } | { line?: undefined; askUrl: string; repo: string; run: PitchRun } {
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) return { line: 'off' };
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni pitch: no repository slug — set repo.slug in the config.');
  const local = localRun(cwd, dir, prd);
  if (local.run === undefined) return { line: local.line };
  return { askUrl: toggle.askUrl, repo, run: local.run };
}

export const pitch = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs, now, launch, openBrowser, studioUntil }: FreeIo & PitchOptions) {
    const [verb, ...rest] = args;
    if (isOneOf(keysOf(PITCH_MAKERS), verb)) return PITCH_MAKERS[verb](rest, { cwd, stdout, stderr, exec, tokens, home, fetch, callMs, now, launch, openBrowser, studioUntil });
    if (verb !== 'push') throw usageError(VERBS);
    const { prd, dir } = argsOf(args);
    const ctx = loadContext(cwd, { exec });
    const ready = pushable(ctx, cwd, dir, prd);
    if (ready.line !== undefined) {
      println(stderr, ready.line);
      return 1;
    }
    return send({ askUrl: ready.askUrl, repo: ready.repo, prd, run: ready.run }, { stdout, stderr, tokens, home, fetch, callMs });
  },
} satisfies FreeCommand;
