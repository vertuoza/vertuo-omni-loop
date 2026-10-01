// @ts-nocheck
// `omni proof session [<file>]` — writes the signed-in Playwright session `/omni:prove` films with
// (`proof.setup`), to `<file>` or to `$PROOF_STORAGE_STATE`, from the person's own `omni signin`, its
// cookie on the host of `$PROOF_URL` (the address filmed, a preview's) or else of `ask.url`
// (`../../lib/proof/session.ts`). It renews the sign-in first, so the session holds a full hour, and
// prints `signed in as <email> until <HH:MM>`. No sign-in, or one the server refuses, is
// `no sign-in (omni signin)`, and a server that does not answer `unreachable`: exit 1, no file.
//
// `omni proof push <n> <dir>` — sends a proof run `/omni:prove` recorded to PRD n's dossier on the Omni page
// (PRD 798's spec, "The Omni page"), and prints the Proof tab's link, then the GIF's stable link on a
// second line when the run sent a `preview.gif`.
//
// It reads `<dir>/run.json` and the files it names (`../../lib/proof/run.ts`), refusing before anything
// is sent what the app would refuse: a type other than .webm, .gif, .ts or .txt is `refused (400)`, a
// file over 50 MB `refused (413)`. Then it asks for a signed upload link per file, puts each file to its
// own, and registers the run (`../../lib/proof/push.ts`).
//
// It never blocks the skill that runs it, and speaks as `omni dossier link` does: anything that stops it
// is exit 1 with one line — `none` (PRD n has no dossier), `off`, `no sign-in (omni signin)`,
// `unreachable`, `refused (<status>)` or `refused (403): <the server's reason>`. A local refusal carries
// its reason after the status. Exit 2 is the kit not installed here, a config that does not read, a
// folder without run.json, or arguments it cannot run.
//
// It runs before a context exists, like `dossier`, so that a test can hand it `tokens`, `home`, `fetch`
// and `callMs`; it loads the context itself.
import { writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import { ProofReplyError, pushProof } from '../../lib/proof/push.ts';
import { ProofRunRefused, readRun, RUN_FILE } from '../../lib/proof/run.ts';
import { SessionRefused, storageState } from '../../lib/proof/session.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';

const USAGE = 'usage: omni proof push <n> <dir> | omni proof session [<file>]';
const NO_SIGN_IN = 'no sign-in (omni signin)';

/** The one line a failed call is reported with, as `omni dossier link` words it. */
function skipLine(error) {
  if (error instanceof ProofReplyError) return `refused (${error.message})`;
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  if (error.status === 404) return 'none';
  return error.status === 403 && error.reason ? `refused (403): ${error.reason}` : `refused (${error.status})`;
}

/** What `omni proof push <n> <dir>` or `omni proof session [<file>]` names, or a usage error. */
function argsOf(args, env) {
  const { positional } = parseArgs('proof', args);
  const [verb, first, second, ...rest] = positional;
  if (verb === 'session') {
    const file = first ?? env?.PROOF_STORAGE_STATE;
    if (!file || second !== undefined) throw usageError(`${USAGE} (session needs <file> or PROOF_STORAGE_STATE)`);
    return { verb, file };
  }
  if (verb !== 'push' || second === undefined || rest.length) throw usageError(USAGE);
  return { verb, prd: positiveInt('proof push', '<n>', first), dir: second };
}

/** The run in `dir`, or the one line a local refusal is reported with. */
function localRun(cwd, dir) {
  const folder = isAbsolute(dir) ? dir : resolve(cwd, dir);
  let run;
  try {
    run = readRun(folder);
  } catch (error) {
    if (!(error instanceof ProofRunRefused)) throw error;
    return { line: `refused (${error.status}): ${error.message}` };
  }
  if (!run) throw usageError(`omni proof push: ${dir} holds no ${RUN_FILE}.`);
  return { run };
}

/** Sends the run and prints its links, or the one line that stopped it; the exit code. */
async function send({ toggle, repo, prd, run }, { stdout, stderr, tokens, home, fetch, callMs }) {
  const host = credentialsHost(toggle.askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) {
    println(stderr, NO_SIGN_IN);
    return 1;
  }
  const client = askClient({ baseUrl: toggle.askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) });
  let pushed;
  try {
    pushed = await pushProof({ client, repo, prd, run });
  } catch (error) {
    println(stderr, skipLine(error));
    return 1;
  }
  println(stdout, pushed.tab);
  if (pushed.gif) println(stdout, pushed.gif);
  return 0;
}

/** `HH:MM`, local time, of a moment in seconds. */
const clock = (seconds) => new Date(seconds * 1000).toTimeString().slice(0, 5);

/** The access token of a sign-in renewed just now, or the one line that stopped it. */
async function renewedToken(askUrl, { tokens, home, fetch, callMs }) {
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) return { line: NO_SIGN_IN };
  const outcome = await askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) }).renew();
  if (outcome === 'renewed') return { host, token: store.read(host).access_token };
  return { line: outcome === 'refused' ? NO_SIGN_IN : 'unreachable' };
}

/** The session a token makes, or null when it is not a sign-in the app would take. */
function sessionFor(token, host) {
  try {
    return storageState(token, { host });
  } catch (error) {
    if (error instanceof SessionRefused) return null;
    throw error;
  }
}

/** The host of the address a run films (`PROOF_URL`, a preview's), or undefined for ask.url's own. */
function targetHost(url) {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    throw usageError(`omni proof session: PROOF_URL is not a URL: ${url}`);
  }
}

/** Renews the sign-in and writes the session to `file`, or prints the one line that stopped it; the exit code. */
async function writeSession({ askUrl, file, target }, { stdout, stderr, ...io }) {
  const renewed = await renewedToken(askUrl, io);
  const made = renewed.token ? sessionFor(renewed.token, target ?? renewed.host) : null;
  if (!made) {
    println(stderr, renewed.line ?? NO_SIGN_IN);
    return 1;
  }
  writeFileSync(file, JSON.stringify(made.state), { mode: 0o600 });
  println(stdout, `signed in as ${made.email ?? 'you'} until ${clock(made.expiresAt)}`);
  return 0;
}

export const proof = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, env, tokens, home, fetch = globalThis.fetch, callMs }) {
    const parsed = argsOf(args, env);
    const ctx = loadContext(cwd, { exec });
    if (parsed.verb === 'session') {
      const askUrl = ctx.config.ask?.url;
      if (!askUrl) throw usageError('omni proof session: no sign-in server here — set ask.url in the config.');
      const file = isAbsolute(parsed.file) ? parsed.file : resolve(cwd, parsed.file);
      return writeSession({ askUrl, file, target: targetHost(env?.PROOF_URL) }, { stdout, stderr, tokens, home, fetch, callMs });
    }
    const { prd, dir } = parsed;
    const toggle = dossierSwitch(ctx.config);
    if (!toggle.on) {
      println(stderr, 'off');
      return 1;
    }
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError('omni proof: no repository slug — set repo.slug in the config.');
    const local = localRun(cwd, dir);
    if (local.line) {
      println(stderr, local.line);
      return 1;
    }
    return send({ toggle, repo, prd, run: local.run }, { stdout, stderr, tokens, home, fetch, callMs });
  },
};
