// `omni pitch start|slide|music|video` make a pitch on the person's computer (`./pitch-make.mjs`);
// `omni pitch push <n> <dir>` — sends a pitch run `/omni:pitch` made of shipped PRD n to its dossier on
// the Omni page (PRD 859's spec, "Push"), and prints the Pitch tab's link, then the GIF's stable link (the
// one that opens without signing in) on a second line.
//
// It reads `<dir>/pitch.json` and the five files every pitch holds (`../../lib/pitch/push-run.mjs`),
// refusing before anything is sent what the app would refuse: a file of the five missing, an audience,
// look, commit or word out of shape is `refused (400): <why>`, a file over 50 MB `refused (413): <why>`.
// Then it asks for a signed upload link per file, puts each file to its own, and registers the run
// (`../../lib/pitch/push.mjs`). It never retries.
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
import { askClient, AskCallError } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { credentialsHost } from '../../lib/ask/credentials.mjs';
import { dossierSwitch } from '../../lib/config.mjs';
import { loadContext } from '../../lib/context.mjs';
import { PitchReplyError, pushPitch } from '../../lib/pitch/push.mjs';
import { PITCH_RUN_FILE, PitchRunRefused, readPitchRun } from '../../lib/pitch/push-run.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';
import { PITCH_MAKERS } from './pitch-make.mjs';

const USAGE = 'usage: omni pitch push <n> <dir>';
const VERBS = 'usage: omni pitch start|slide|music|video|push …';
const NO_SIGN_IN = 'no sign-in (omni signin)';

/** The one line a failed call is reported with, as `omni proof push` words it. */
function skipLine(error) {
  if (error instanceof PitchReplyError) return `refused (${error.message})`;
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  if (error.status === 404) return 'none';
  if (error.status === 422) return 'not shipped';
  return error.status === 403 && error.reason ? `refused (403): ${error.reason}` : `refused (${error.status})`;
}

/** What `omni pitch push <n> <dir>` names, or a usage error. */
function argsOf(args) {
  const { positional } = parseArgs('pitch', args);
  const [verb, first, second, ...rest] = positional;
  if (verb !== 'push' || second === undefined || rest.length) throw usageError(USAGE);
  return { prd: positiveInt('pitch push', '<n>', first), dir: second };
}

/** The run in `dir`, or the one line a local refusal is reported with. */
function localRun(cwd, dir, prd) {
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

/** A client signed in to the Omni page at `askUrl`, or null when this computer holds no sign-in for it. */
function signedInClient(askUrl, { tokens, home, fetch, callMs }) {
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  const timeout = callMs ? { callMs } : {};
  return store.read(host) ? askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...timeout }) : null;
}

/** Sends the run and prints its links, or the one line that stopped it; the exit code. */
async function send({ toggle, repo, prd, run }, { stdout, stderr, ...io }) {
  const client = signedInClient(toggle.askUrl, io);
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

export const pitch = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs, now, screenshot }) {
    const [verb, ...rest] = args;
    const maker = Object.hasOwn(PITCH_MAKERS, verb) ? PITCH_MAKERS[verb] : null;
    if (maker) return maker(rest, { cwd, stdout, stderr, exec, tokens, home, fetch, callMs, now, screenshot });
    if (verb !== 'push') throw usageError(VERBS);
    const { prd, dir } = argsOf(args);
    const ctx = loadContext(cwd, { exec });
    const ready = pushable(ctx, cwd, dir, prd);
    if (ready.line) {
      println(stderr, ready.line);
      return 1;
    }
    const target = { toggle: dossierSwitch(ctx.config), repo: ctx.config.repo.slug, prd, run: ready.run };
    return send(target, { stdout, stderr, tokens, home, fetch, callMs });
  },
};

/** The run to send, or the one line that stops the push before any call: `off`, or a local refusal. */
function pushable(ctx, cwd, dir, prd) {
  if (!dossierSwitch(ctx.config).on) return { line: 'off' };
  if (!ctx.config.repo.slug) throw usageError('omni pitch: no repository slug — set repo.slug in the config.');
  return localRun(cwd, dir, prd);
}
