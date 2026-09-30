// `omni proof push <n> <dir>` — sends a proof run `/omni:prove` recorded to PRD n's dossier on the Omni page
// (PRD 798's spec, "The Omni page"), and prints the Proof tab's link, then the GIF's stable link on a
// second line when the run sent a `preview.gif`.
//
// It reads `<dir>/run.json` and the files it names (`../../lib/proof/run.mjs`), refusing before anything
// is sent what the app would refuse: a type other than .webm, .gif, .ts or .txt is `refused (400)`, a
// file over 50 MB `refused (413)`. Then it asks for a signed upload link per file, puts each file to its
// own, and registers the run (`../../lib/proof/push.mjs`).
//
// It never blocks the skill that runs it, and speaks as `omni dossier link` does: anything that stops it
// is exit 1 with one line — `none` (PRD n has no dossier), `off`, `no sign-in (omni signin)`,
// `unreachable`, `refused (<status>)` or `refused (403): <the server's reason>`. A local refusal carries
// its reason after the status. Exit 2 is the kit not installed here, a config that does not read, a
// folder without run.json, or arguments it cannot run.
//
// It runs before a context exists, like `dossier`, so that a test can hand it `tokens`, `home`, `fetch`
// and `callMs`; it loads the context itself.
import { isAbsolute, resolve } from 'node:path';
import { askClient, AskCallError } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { credentialsHost } from '../../lib/ask/credentials.mjs';
import { dossierSwitch } from '../../lib/config.mjs';
import { loadContext } from '../../lib/context.mjs';
import { ProofReplyError, pushProof } from '../../lib/proof/push.mjs';
import { ProofRunRefused, readRun, RUN_FILE } from '../../lib/proof/run.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni proof push <n> <dir>';
const NO_SIGN_IN = 'no sign-in (omni signin)';

/** The one line a failed call is reported with, as `omni dossier link` words it. */
function skipLine(error) {
  if (error instanceof ProofReplyError) return `refused (${error.message})`;
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  if (error.status === 404) return 'none';
  return error.status === 403 && error.reason ? `refused (403): ${error.reason}` : `refused (${error.status})`;
}

/** The PRD number and folder `omni proof push <n> <dir>` names, or a usage error. */
function argsOf(args) {
  const { positional } = parseArgs('proof', args);
  const [verb, number, dir, ...rest] = positional;
  if (verb !== 'push' || dir === undefined || rest.length) throw usageError(USAGE);
  return { prd: positiveInt('proof push', '<n>', number), dir };
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

export const proof = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs }) {
    const { prd, dir } = argsOf(args);
    const ctx = loadContext(cwd, { exec });
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
