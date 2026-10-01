// @ts-nocheck
// `omni decide <decision> --state-file <json> --old <value> [--ref <text>] [--json]` (PRD 812): asks
// the workspace's Jev decision through `POST /api/decide/<decision>`, with the terminal's sign-in, as
// `omni business show` reads the business. The key never reaches this computer: the Omni page calls Jev.
//
// The agent makes its own call first and passes it as `--old` (decision 12), and the state it writes
// to the JSON file is what the decision sends Jev (decision 10). It prints `<answer> <confidence>`
// when Jev's answer counted (the decision On, Jev sure enough), and `unset` otherwise: the decision
// Off or in Shadow, no Omni page set here, no sign-in, a refusal, a timeout, a server without the
// verb or a reply that is not a decision. Then the agent keeps its own answer. `--json` prints
// `{ decision, answer, confidence, decidedBy, reason }`, `reason` saying why when it is unset.
//
// Jev can never block anything (decision 6): every decision outcome exits 0, and why it is unset goes
// to stderr in one line. Exit 2 is only for a usage error, an unreadable state file, the kit not
// installed here or a config that does not read. Any decision name is sent: the app refuses one it
// does not know, which prints `unset` like any refusal.
//
// It runs before a context exists, like `business`, so that a test can hand it `tokens` (the token
// store), `home` (where the real one lives), `fetch` and `callMs`; it loads the context itself.
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, println, readUserFile, usageError } from '../args.ts';

const USAGE = 'usage: omni decide <decision> --state-file <json> --old <value> [--ref <text>] [--json]';
/** The Omni page waits 5 s for Jev, then reads and logs: the call gets twice that. */
const DECIDE_MS = 10_000;
const UNSET = 'unset';

const isUnit = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Jev's answer and confidence when the reply says it counted, or the reason it is unset. */
function readReply(reply) {
  if (reply?.decidedBy === 'old') return { reason: 'the decision is Off or in Shadow, or Jev did not decide' };
  if (reply?.decidedBy === 'jev' && typeof reply.answer === 'string' && reply.answer !== '' && isUnit(reply.confidence)) {
    return { answer: reply.answer, confidence: reply.confidence };
  }
  return { reason: 'the reply is not a decision' };
}

/** Why a call failed, in one line. */
function failed(error) {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'the Omni page could not be reached';
  if (error.status === 401) return 'the sign-in was refused (omni signin)';
  return `refused (${error.status})${error.reason ? `: ${error.reason}` : ''}`;
}

function stateOf(ctx, path) {
  const text = readUserFile('decide', ctx, path);
  try {
    return JSON.parse(text);
  } catch {
    throw usageError(`omni decide: ${path} is not JSON.`);
  }
}

/** The reply, or the reason there is none: no Omni page here, no sign-in, or a failed call. */
async function ask({ ctx, decision, state, old, ref, tokens, home, fetch, callMs }) {
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni decide: no repository slug — set repo.slug in the config.');
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return { reason: 'no Omni page is set here (ask.url)' };
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) return { reason: 'no sign-in (omni signin)' };
  const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch, callMs: callMs ?? DECIDE_MS });
  try {
    return readReply(await client.decide({ decision, repo, state, old, ref }));
  } catch (error) {
    return { reason: failed(error) };
  }
}

/** The command's arguments, or a usage error. */
function readArgs(args) {
  const { positional, flags } = parseArgs('decide', args, { values: ['state-file', 'old', 'ref'], booleans: ['json'] });
  const stateFile = flags['state-file'];
  const old = flags.old;
  if (positional.length !== 1 || typeof stateFile !== 'string' || typeof old !== 'string') throw usageError(USAGE);
  const ref = typeof flags.ref === 'string' && flags.ref.trim() ? flags.ref : null;
  return { decision: positional[0], stateFile, old, ref, json: Boolean(flags.json) };
}

/** What was decided, as one line or as JSON; and, when your own answer counts, why on stderr. */
function report({ stdout, stderr, decision, read, json }) {
  const counted = read.answer !== undefined;
  if (json) {
    const shown = counted
      ? { decision, answer: read.answer, confidence: read.confidence, decidedBy: 'jev', reason: null }
      : { decision, answer: null, confidence: null, decidedBy: 'old', reason: read.reason };
    println(stdout, JSON.stringify(shown));
  } else {
    println(stdout, counted ? `${read.answer} ${read.confidence.toFixed(2)}` : UNSET);
  }
  if (!counted) println(stderr, `omni decide ${decision}: ${read.reason} — your own answer counts`);
}

export const decide = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs }) {
    const { decision, stateFile, old, ref, json } = readArgs(args);
    const ctx = loadContext(cwd, { exec });
    const state = stateOf(ctx, stateFile);
    const read = await ask({ ctx, decision, state, old, ref, tokens, home, fetch, callMs });
    report({ stdout, stderr, decision, read, json });
    return 0;
  },
};
