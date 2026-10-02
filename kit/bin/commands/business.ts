// `omni business show [--json]` — the business agents in this repository read (PRD 748's spec, "The
// read"): the confirmed claims of its workspace's business, the region from the business and the rest
// from the repository's product, read with the terminal's sign-in through `GET /api/business`.
//
// It prints the sentence the claims make, then one line per claim with its id (`rival#4`). `--json`
// prints `{ state, business, product, claims, personas }` (decision 14), the shape the later MCP link returns.
// Each claim carries its `state` (PRD 774, decision 12): `confirmed`, or `contradicted` while evidence
// disagrees with it and nobody answered. A contradicted claim is marked on its line and left out of the
// sentence, so an agent never states it as settled. A server from before PRD 774 sends no state: it
// only ever sent confirmed claims, so its claims read as confirmed. A proposed or rejected claim never
// leaves the app, and a reply carrying one is refused.
//
// It also carries the product's personas (PRD 799): `personas: [{ name, stance, trade, who, usage }]`,
// oldest first, `[]` when there are none, and one `persona` line each under the claims. They never
// decide `state`, which comes from claims only: a product with personas and no confirmed claim reads
// `none`, and still prints its personas. A server from before PRD 799 sends none: they read as `[]`.
//
// It never blocks an agent (decision 13): every reading outcome exits 0. When there is nothing to
// read it prints one line ending "— agents carry on", and `--json` says which in `state`:
//   none         the workspace has no business, or no confirmed claim for this repository
//   no-sign-in   no Omni page set here (ask.url), no sign-in for it, or a sign-in it no longer honours
//   unreachable  the Omni page could not be reached in time
//   refused      the Omni page refused the read (its status, and its reason when it gave one)
// PRD 839 adds the product's Never lines, the lines the team never crosses: claims of kind `never`,
// printed as `never#<seq>` lines like any other claim and carried by `--json` as claims. They are no
// part of the sentence.
//
// Exit 2 is only for a usage error, the kit not installed here or a config that does not read.
//
// `omni business cited <id>… --by <skill> [--ref <text>]` logs the claims an agent cited through
// `POST /api/business/citations`, so the page shows how often each is cited. It never blocks either:
// any failed call prints one "citation skipped: … — agents carry on" line and exits 0.
//
// `omni business claim add --kind <kind> --value <value> --state proposed|confirmed --ref <text>` stores a
// claim a person gave as an answer (PRD 822): source `answer`, the receipt `ref` (`<skill> · <run>`),
// `proposed` when it overrules the voice (a member confirms it on Settings › Business) or `confirmed` when
// it answers the gap question, through `POST /api/business/claims`. A value the business already holds is
// not added twice: the reply says so. It never blocks either: any failed call prints one
// "claim skipped: … — agents carry on" line and exits 0. A missing flag, an unknown kind or state, or a
// blank value or ref is a usage error, exit 2.
//
// It runs before a context exists, like `dossier`, so that a test can hand it `tokens` (the token
// store), `home` (where the real one lives), `fetch` and `callMs`; it loads the context itself.
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { jsonObject } from '../../lib/ask/schema.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo, Out } from '../io.ts';

/** One claim, as the contract carries it. */
type Claim = { id: string; kind: string; value: string; source: string; state: string; receipt: string | null; lastSeen: string | null };

/** One persona, as the contract carries it. */
type Persona = { name: string; stance: string; trade: string; who: string; usage: string };

/** The business the server read, as the contract's body. */
type Business = { state: string; business: { name: string } | null; product: { name: string } | null; claims: Claim[]; personas: Persona[] };

/** What a test hands `omni business` beyond `main()`'s own. */
type BusinessOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };

/** What each verb is handed. */
type BusinessIo = { cwd: string; stdout: Out; exec: Exec; tokens: TokenStore | undefined; home: string | undefined; fetch: Fetch; callMs: number | undefined };

/** Where a verb stopped before it could call: the state and the one line. */
type Unreached = { state: string; line: string; client?: undefined; repo?: undefined };

const CLAIM_USAGE = 'usage: omni business claim add --kind <region|offering|size|trade|rival> --value <text> --state <proposed|confirmed> --ref <text>';
const USAGE = `usage: omni business show [--json] | omni business cited <id>… --by <skill> [--ref <text>] | ${CLAIM_USAGE.slice('usage: '.length)}`;
const CITED_USAGE = 'usage: omni business cited <id>… --by <skill> [--ref <text>]';
/** The states an answered claim is stored in: an overrule's (proposed) or a gap question's (confirmed). */
const ANSWER_STATES: readonly string[] = ['proposed', 'confirmed'];
/** Every state a stored claim may be in: a value already held keeps its own. */
const STORED_STATES: readonly unknown[] = ['proposed', 'confirmed', 'rejected', 'contradicted', 'unknown'];
const CARRY_ON = '— agents carry on';
/** The kinds a person may answer as a claim. */
const KINDS: readonly string[] = ['region', 'offering', 'size', 'trade', 'rival'];
/** The kinds a read carries: the answerable ones and the product's Never lines (PRD 839). */
const READ_KINDS: readonly unknown[] = [...KINDS, 'never'];
const SOURCES: readonly unknown[] = ['pick', 'suggestion', 'evidence', 'answer'];
const STATES: readonly unknown[] = ['confirmed', 'contradicted'];
const STANCES: readonly unknown[] = ['excited', 'neutral', 'skeptical'];
const BLANK = '___';
const CONTRADICTED = '  (contradicted: evidence disagrees, nobody answered yet)';

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const named = (value: unknown): { name: string } | null => {
  const name = jsonObject(value)?.name;
  return isText(name) ? { name } : null;
};

/** One claim as the contract carries it, its fields in the contract's order, or null when it is not one. */
function claimOf(raw: unknown): Claim | null {
  const value = jsonObject(raw);
  if (!value || !isText(value.id) || !READ_KINDS.includes(value.kind) || !isText(value.value) || !SOURCES.includes(value.source)) return null;
  const kind = String(value.kind);
  if (!value.id.startsWith(`${kind}#`)) return null;
  const state = value.state ?? 'confirmed';
  if (!STATES.includes(state)) return null;
  const orNull = (field: unknown): string | null => (isText(field) ? field : null);
  return {
    id: value.id, kind, value: value.value, source: String(value.source), state: String(state),
    receipt: orNull(value.receipt), lastSeen: orNull(value.lastSeen),
  };
}

/** One persona as the contract carries it, its fields in the contract's order, or null when it is not one. */
function personaOf(raw: unknown): Persona | null {
  const value = jsonObject(raw);
  if (!value || !isText(value.name) || !STANCES.includes(value.stance) || !isText(value.trade)) return null;
  if (typeof value.who !== 'string' || typeof value.usage !== 'string') return null;
  return { name: value.name, stance: String(value.stance), trade: value.trade, who: value.who, usage: value.usage };
}

/** The reply's claims, or null when one is not a claim or they disagree with its state. */
function claimsOf(reply: { state: unknown; claims: unknown[] }): Claim[] | null {
  const claims = reply.claims.map(claimOf);
  if (!claims.every((one) => one !== null)) return null;
  return (reply.state === 'ok') === (claims.length > 0) ? claims : null;
}

/** The reply's personas (`[]` when it sends none), or null when one is not a persona. */
function personasOf(value: unknown): Persona[] | null {
  if (value !== undefined && !Array.isArray(value)) return null;
  const personas = ((value ?? []) as unknown[]).map(personaOf); // ts-allow: an array, or undefined read as none
  return personas.every((one) => one !== null) ? personas : null;
}

/** The server's reply as the contract's body, or null when it does not read as one. */
function businessOf(raw: unknown): Business | null {
  const reply = jsonObject(raw);
  if (!reply || !['ok', 'none'].includes(String(reply.state)) || typeof reply.state !== 'string' || !Array.isArray(reply.claims)) return null;
  const claims = claimsOf({ state: reply.state, claims: reply.claims });
  const personas = claims && personasOf(reply.personas);
  if (!claims || !personas) return null;
  return { state: reply.state, business: named(reply.business), product: named(reply.product), claims, personas };
}

/** One printed line per persona, its label padded to the claims' ids. */
const personaLines = (personas: readonly Persona[], width: number): string[] => personas.map((p) =>
  `  ${'persona'.padEnd(width)}  ${p.name} (${p.stance}, ${p.trade}): ${p.who || '—'} — uses: ${p.usage || '—'}`);

/** `a`, `a and b`, `a, b and c`. */
const joined = (values: readonly string[]): string => (values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`);

/** The sentence the confirmed claims make, its blanks left where a kind has none (the Settings page's own). */
function sentence(claims: readonly Claim[]): string {
  const of = (kind: string) => claims.filter((claim) => claim.kind === kind && claim.state === 'confirmed').map((claim) => claim.value);
  const blankOr = (values: readonly string[]) => joined(values) || BLANK;
  const size = of('size')[0];
  const who = size ? `${size.replace('-', '–')}-person` : `${BLANK}-person`;
  return `We sell ${blankOr(of('offering'))} to ${who} ${blankOr(of('trade'))} in ${blankOr(of('region'))}, up against ${blankOr(of('rival'))}.`;
}

/** The body `--json` prints when there is nothing to read. */
const empty = (state: string, read: Business | null = null) =>
  ({ state, business: read?.business ?? null, product: read?.product ?? null, claims: [], personas: read?.personas ?? [] });

/** Where the read stopped, as the one line and the `--json` body. */
function stopped(error: unknown): { state: string; line: string } {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return { state: 'unreachable', line: `the Omni page could not be reached ${CARRY_ON}` };
  if (error.status === 401) return { state: 'no-sign-in', line: `the sign-in was refused (omni signin) ${CARRY_ON}` };
  const why = error.reason ? `: ${error.reason}` : '';
  return { state: 'refused', line: `refused (${error.status})${why} ${CARRY_ON}` };
}

function print({ json, stdout }: { json: boolean; stdout: Out }, body: unknown, lines: readonly string[]): number {
  if (json) println(stdout, JSON.stringify(body));
  else for (const line of lines) println(stdout, line);
  return 0;
}

/**
 * This repository's slug and a client signed in to its Omni page, or `{ state, line }` when there is
 * none to call: no Omni page set here, or no sign-in for it.
 */
function reach({ cwd, exec, tokens, home, fetch, callMs }: BusinessIo): Unreached | { repo: string; client: ReturnType<typeof askClient> } {
  const ctx = loadContext(cwd, { exec });
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni business: no repository slug — set repo.slug in the config.');
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return { state: 'no-sign-in', line: `no Omni page is set here (ask.url) ${CARRY_ON}` };
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) return { state: 'no-sign-in', line: `no sign-in (omni signin) ${CARRY_ON}` };
  return { repo, client: askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) }) };
}

/** Prints the one "<what> skipped: …" line a failed write prints, and exits 0: it never stops a run. */
function skipped(env: BusinessIo, what: string, line: string): number {
  println(env.stdout, `${what} skipped: ${line}`);
  return 0;
}

/** The reply of `call` to this repository's Omni page, or the one line saying why there is none. */
async function called(
  env: BusinessIo,
  call: (client: ReturnType<typeof askClient>, repo: string) => Promise<unknown>,
): Promise<{ reply: unknown } | { line: string }> {
  const reached = reach(env);
  if (reached.client === undefined) return { line: reached.line };
  try {
    return { reply: await call(reached.client, reached.repo) };
  } catch (error) {
    return { line: stopped(error).line };
  }
}

/**
 * `omni business cited <id>… --by <skill> [--ref <text>]`: appends one citation per id to the
 * business's log. The ids are the server's to judge, so a skill line naming a wrong one never stops a
 * run: every failed call prints one "citation skipped" line and exits 0.
 */
async function cited(ids: string[], flags: { by?: string; ref?: string }, env: BusinessIo): Promise<number> {
  const by = flags.by;
  if (ids.length === 0 || typeof by !== 'string' || !by.trim()) throw usageError(CITED_USAGE);
  const ref = typeof flags.ref === 'string' && flags.ref.trim() ? flags.ref : null;
  const result = await called(env, (client, repo) => client.citeClaims({ repo, ids, by, ref }));
  if ('line' in result) return skipped(env, 'citation', result.line);
  println(env.stdout, `cited ${ids.join(', ')} (${[by, ref].filter(Boolean).join(', ')})`);
  return 0;
}

/** The claim `claim add` was given, or a `UsageError` saying what is missing or wrong. */
function answerOf(
  positional: string[],
  flags: { kind?: string; value?: string; state?: string; ref?: string },
): { kind: string; value: string; state: string; ref: string } {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const [kind, value, state, ref] = [text(flags.kind), text(flags.value), text(flags.state), text(flags.ref)];
  if (positional.length !== 1 || positional[0] !== 'add' || kind === null || value === null || state === null || ref === null) throw usageError(CLAIM_USAGE);
  if (!KINDS.includes(kind)) throw usageError(`omni business claim add: --kind is one of ${KINDS.join(', ')}.`);
  if (!ANSWER_STATES.includes(state)) throw usageError(`omni business claim add: --state is ${ANSWER_STATES.join(' or ')}.`);
  return { kind, value, state, ref };
}

/** The server's reply to a stored claim, or null when it does not read as one. */
const storedOf = (raw: unknown): { id: string; state: string; added: boolean } | null => {
  const reply = jsonObject(raw);
  return reply && isText(reply.id) && STORED_STATES.includes(reply.state) && typeof reply.added === 'boolean'
    ? { id: reply.id, state: String(reply.state), added: reply.added }
    : null;
};

/**
 * `omni business claim add …`: stores a claim a person answered. The kind, value and state are the
 * server's to judge in the end, so a refusal never stops a run: every failed call prints one
 * "claim skipped" line and exits 0.
 */
async function claim(positional: string[], flags: { kind?: string; value?: string; state?: string; ref?: string }, env: BusinessIo): Promise<number> {
  const answer = answerOf(positional, flags);
  const result = await called(env, (client, repo) => client.addClaim({ repo, ...answer }));
  if ('line' in result) return skipped(env, 'claim', result.line);
  const stored = storedOf(result.reply);
  if (!stored) return skipped(env, 'claim', `refused (the reply is not a claim) ${CARRY_ON}`);
  println(env.stdout, `claim ${stored.added ? 'saved' : 'already held'}: ${stored.id} (${stored.state})`);
  return 0;
}

/** What `show` prints of a business it read: the `--json` body and the lines. */
function shown(repo: string, read: Business): [unknown, string[]] {
  if (read.state === 'none') {
    const line = read.business ? `no confirmed claim for ${repo} yet ${CARRY_ON}` : `no business for ${repo} yet ${CARRY_ON}`;
    return [empty('none', read), [line, ...personaLines(read.personas, 'persona'.length)]];
  }
  const idWidth = Math.max(...read.claims.map((claim) => claim.id.length), read.personas.length ? 'persona'.length : 0);
  return [read, [
    sentence(read.claims),
    ...read.claims.map((claim) => `  ${claim.id.padEnd(idWidth)}  ${claim.value}${claim.state === 'contradicted' ? CONTRADICTED : ''}`),
    ...personaLines(read.personas, idWidth),
  ]];
}

/** `omni business show [--json]`: reads the business and prints it, or the one line saying why not. */
async function show(args: string[], env: BusinessIo): Promise<number> {
  const { positional, flags } = parseArgs('business', args, { booleans: ['json'] });
  if (positional.length !== 1 || positional[0] !== 'show') throw usageError(USAGE);
  const out = { json: flags.json === true, stdout: env.stdout };

  const reached = reach(env);
  if (reached.client === undefined) return print(out, empty(reached.state), [reached.line]);
  const { repo, client } = reached;
  let reply: unknown;
  try {
    reply = await client.readBusiness(repo);
  } catch (error) {
    const { state, line } = stopped(error);
    return print(out, empty(state), [line]);
  }
  const read = businessOf(reply);
  if (!read) return print(out, empty('refused'), [`refused (the reply is not a business) ${CARRY_ON}`]);
  return print(out, ...shown(repo, read));
}

export const business = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, exec, tokens, home, fetch = globalThis.fetch, callMs }: FreeIo & BusinessOptions) {
    const env: BusinessIo = { cwd, stdout, exec, tokens, home, fetch, callMs };
    if (args[0] === 'cited') {
      const { positional, flags } = parseArgs('business', args.slice(1), { values: ['by', 'ref'] });
      return cited(positional, flags, env);
    }
    if (args[0] === 'claim') {
      const { positional, flags } = parseArgs('business', args.slice(1), { values: ['kind', 'value', 'state', 'ref'] });
      return claim(positional, flags, env);
    }
    return show(args, env);
  },
} satisfies FreeCommand;
