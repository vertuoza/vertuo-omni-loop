// `omni business show [--json]` — the business agents in this repository read (PRD 748's spec, "The
// read"): the confirmed claims of its workspace's business, the region from the business and the rest
// from the repository's product, read with the terminal's sign-in through `GET /api/business`.
//
// It prints the sentence the claims make, then one line per claim with its id (`rival#4`). `--json`
// prints `{ state, business, product, claims }` (decision 14), the shape the later MCP link returns.
//
// It never blocks an agent (decision 13): every reading outcome exits 0. When there is nothing to
// read it prints one line ending "— agents carry on", and `--json` says which in `state`:
//   none         the workspace has no business, or no confirmed claim for this repository
//   no-sign-in   no Omni page set here (ask.url), no sign-in for it, or a sign-in it no longer honours
//   unreachable  the Omni page could not be reached in time
//   refused      the Omni page refused the read (its status, and its reason when it gave one)
// Exit 2 is only for a usage error, the kit not installed here or a config that does not read.
//
// It runs before a context exists, like `dossier`, so that a test can hand it `tokens` (the token
// store), `home` (where the real one lives), `fetch` and `callMs`; it loads the context itself.
import { askClient, AskCallError } from '../../lib/ask/client.mjs';
import { homeTokens } from '../../lib/ask/client-tokens.mjs';
import { credentialsHost } from '../../lib/ask/credentials.mjs';
import { loadContext } from '../../lib/context.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni business show [--json]';
const CARRY_ON = '— agents carry on';
const KINDS = ['region', 'offering', 'size', 'trade', 'rival'];
const SOURCES = ['pick', 'suggestion', 'evidence', 'answer'];
const BLANK = '___';

const isText = (value) => typeof value === 'string' && value.length > 0;
const named = (value) => (value && isText(value.name) ? { name: value.name } : null);

/** One claim as the contract carries it, its fields in the contract's order, or null when it is not one. */
function claimOf(value) {
  if (!value || !isText(value.id) || !KINDS.includes(value.kind) || !isText(value.value) || !SOURCES.includes(value.source)) return null;
  if (!value.id.startsWith(`${value.kind}#`)) return null;
  const orNull = (field) => (isText(field) ? field : null);
  return { id: value.id, kind: value.kind, value: value.value, source: value.source, receipt: orNull(value.receipt), lastSeen: orNull(value.lastSeen) };
}

/** The server's reply as the contract's body, or null when it does not read as one. */
export function businessOf(reply) {
  if (!reply || !['ok', 'none'].includes(reply.state) || !Array.isArray(reply.claims)) return null;
  const claims = reply.claims.map(claimOf);
  if (claims.includes(null)) return null;
  if ((reply.state === 'ok') !== (claims.length > 0)) return null;
  return { state: reply.state, business: named(reply.business), product: named(reply.product), claims };
}

/** `a`, `a and b`, `a, b and c`. */
const joined = (values) => (values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`);

/** The sentence the claims make, its blanks left where a kind has none (the Settings page's own). */
export function sentence(claims) {
  const of = (kind) => claims.filter((claim) => claim.kind === kind).map((claim) => claim.value);
  const blankOr = (values) => joined(values) || BLANK;
  const size = of('size')[0];
  const who = size ? `${size.replace('-', '–')}-person` : `${BLANK}-person`;
  return `We sell ${blankOr(of('offering'))} to ${who} ${blankOr(of('trade'))} in ${blankOr(of('region'))}, up against ${blankOr(of('rival'))}.`;
}

/** The body `--json` prints when there is nothing to read. */
const empty = (state, read = null) => ({ state, business: read?.business ?? null, product: read?.product ?? null, claims: [] });

/** Where the read stopped, as the one line and the `--json` body. */
function stopped(error) {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return { state: 'unreachable', line: `the Omni page could not be reached ${CARRY_ON}` };
  if (error.status === 401) return { state: 'no-sign-in', line: `the sign-in was refused (omni signin) ${CARRY_ON}` };
  const why = error.reason ? `: ${error.reason}` : '';
  return { state: 'refused', line: `refused (${error.status})${why} ${CARRY_ON}` };
}

function print({ json, stdout }, body, lines) {
  if (json) println(stdout, JSON.stringify(body));
  else for (const line of lines) println(stdout, line);
  return 0;
}

export const business = {
  withoutContext: true,
  async run(args, { cwd, stdout, exec, tokens, home, fetch = globalThis.fetch, callMs }) {
    const { positional, flags } = parseArgs('business', args, { booleans: ['json'] });
    if (positional.length !== 1 || positional[0] !== 'show') throw usageError(USAGE);
    const out = { json: flags.json === true, stdout };

    const ctx = loadContext(cwd, { exec });
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError('omni business: no repository slug — set repo.slug in the config.');
    const askUrl = ctx.config.ask.url;
    if (!askUrl) return print(out, empty('no-sign-in'), [`no Omni page is set here (ask.url) ${CARRY_ON}`]);

    const host = credentialsHost(askUrl);
    const store = tokens ?? homeTokens(home ? { home } : undefined);
    if (!store.read(host)) return print(out, empty('no-sign-in'), [`no sign-in (omni signin) ${CARRY_ON}`]);

    const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) });
    let reply;
    try {
      reply = await client.readBusiness(repo);
    } catch (error) {
      const { state, line } = stopped(error);
      return print(out, empty(state), [line]);
    }
    const read = businessOf(reply);
    if (!read) return print(out, empty('refused'), [`refused (the reply is not a business) ${CARRY_ON}`]);
    if (read.state === 'none') {
      const line = read.business ? `no confirmed claim for ${repo} yet ${CARRY_ON}` : `no business for ${repo} yet ${CARRY_ON}`;
      return print(out, empty('none', read), [line]);
    }
    const width = Math.max(...read.claims.map((claim) => claim.id.length));
    return print(out, read, [
      sentence(read.claims),
      ...read.claims.map((claim) => `  ${claim.id.padEnd(width)}  ${claim.value}`),
    ]);
  },
};
