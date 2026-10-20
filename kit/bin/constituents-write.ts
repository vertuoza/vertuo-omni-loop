// `omni constituents add | edit` (PRD 2268, s3): add or edit the Statement or one Never line of this
// repository's product from the terminal, through `POST /api/knowledge/changes` with the terminal's
// sign-in (`omni signin`, or OMNI_TOKEN), as `omni kb legal add` does (`./kb-write.ts`).
//
//   omni constituents add --statement "<text>" | --never "<text>"
//   omni constituents edit statement|never#<n> --text "<text>"
//   each takes --product <name> and --json
//
// The rules are the Knowledge tab's: only a workspace owner changes a constituent, with no proposal; a
// member's refusal is printed in the database's own words and exits 1. One line on success
// (`added never#4 · <url>` or `edited statement · <url>`), or with `--json` the route's answer. A
// refusal, a missing sign-in or an unreachable page is one line and exit 1 (with `--json`, `{error}` on
// stdout); a missing flag, both of `--statement` and `--never`, a bad id or an unknown flag is a usage
// error, exit 2. It never writes the constituents' cache: the next read does. No remove and no retire.
import { askClient, AskCallError } from '../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../lib/ask/client.ts';
import { homeTokens } from '../lib/ask/client-tokens.ts';
import { credentialsHost } from '../lib/ask/credentials.ts';
import { jsonObject } from '../lib/ask/schema.ts';
import { loadContext } from '../lib/context.ts';
import { parseArgs, println, usageError } from './args.ts';
import type { FreeIo } from './io.ts';

/** What a test hands the write beyond the command's own io. */
export type ConstituentsWriteOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined };

type Action = 'add' | 'edit';
type Change = { product?: string; action: Action; entry?: string; fields: Record<string, string> };

const USAGE =
  'usage: omni constituents add --statement "<text>" | --never "<text>" [--product <name>] [--json] | omni constituents edit statement|never#<n> --text "<text>" [--product <name>] [--json]';
const ENTRY = /^(statement|never#[1-9]\d*)$/;

/** A text, trimmed, or null when it is absent or blank. */
const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** The flags and positionals of `args`: an unknown flag is a usage error that carries the usage. */
function parsedOf(args: string[]) {
  try {
    return parseArgs('constituents', args, { values: ['statement', 'never', 'text', 'product'], booleans: ['json'] });
  } catch (error) {
    throw usageError(`${error instanceof Error ? error.message : String(error)} ${USAGE}`);
  }
}

/** The shapes a command may have, as `<action> <fields given> <positionals after the action>`. */
const SHAPES = ['add statement 0', 'add never 0', 'edit text 1'];

/** The text fields the flags give, by name, none blank. */
function fieldsOf(flags: Record<string, string | true | undefined>): Record<string, string> {
  const given = ['statement', 'never', 'text'].map((name): [string, string | null] => [name, textOf(flags[name])]);
  return Object.fromEntries(given.filter((pair): pair is [string, string] => pair[1] !== null));
}

/** The change `args` asks for, or a `UsageError` saying what is missing or wrong. */
function changeOf(args: string[]): { change: Change; json: boolean } {
  const { positional, flags } = parsedOf(args);
  const [verb = '', ...rest] = positional;
  const fields = fieldsOf(flags);
  const [entry] = rest;
  if (!SHAPES.includes(`${verb} ${Object.keys(fields).join(',')} ${rest.length}`) || (entry !== undefined && !ENTRY.test(entry))) throw usageError(USAGE);
  const product = textOf(flags.product);
  const change: Change = { action: verb === 'add' ? 'add' : 'edit', fields, ...(product === null ? {} : { product }), ...(entry === undefined ? {} : { entry }) };
  return { change, json: flags.json === true };
}

/** The line a successful change prints, or null when the reply is not one. */
function successLine(action: Action, reply: unknown): string | null {
  const answer = jsonObject(reply);
  if (!answer) return null;
  const [id, url] = [textOf(answer.id), textOf(answer.url)];
  return answer.done === 'applied' && id !== null ? `${action === 'add' ? 'added' : 'edited'} ${id}${url === null ? '' : ` · ${url}`}` : null;
}

/** The one line a failed call says, in the server's own words when it gave them. */
function refusalLine(error: unknown, host: string): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return error.message.startsWith('not signed in') ? `no sign-in for ${host} (omni signin)` : 'the Omni page could not be reached';
  if (error.status === 401) return 'the sign-in was refused (omni signin)';
  return error.reason ?? `refused (${error.status})`;
}

/** `omni constituents add | edit`: see the top of this file. */
export async function constituentsWrite(args: string[], io: FreeIo, options: ConstituentsWriteOptions): Promise<number> {
  const { change, json } = changeOf(args);
  const stop = (line: string): number => {
    if (json) println(io.stdout, JSON.stringify({ error: line }));
    else println(io.stderr, `omni constituents ${change.action}: ${line}`);
    return 1;
  };
  const reached = reach(io, options);
  if (typeof reached === 'string') return stop(reached);
  try {
    const reply = await reached.client.changeKnowledge({ repo: reached.repo, kind: 'constituent', ...change });
    const line = successLine(change.action, reply);
    if (line !== null) println(io.stdout, json ? JSON.stringify(reply) : line);
    return line === null ? stop('the Omni page answered something this kit does not read') : 0;
  } catch (error) {
    return stop(refusalLine(error, reached.host));
  }
}

/** This checkout's repository and its Omni page's address, or the one line saying why there is none. */
function targetOf({ cwd, exec }: FreeIo): { repo: string; askUrl: string } | string {
  let ctx;
  try {
    ctx = loadContext(cwd, { exec });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'ConfigError') throw error;
    return error.message.split('\n')[0] ?? 'the kit is not set up here';
  }
  const { url: askUrl } = ctx.config.ask;
  const { slug: repo } = ctx.config.repo;
  if (!askUrl) return 'no Omni page is set here (ask.url)';
  return repo ? { repo, askUrl } : 'no repository slug — set repo.slug in the config';
}

/** This checkout's repository and the client to its Omni page, or the one line saying why there is none. */
function reach(io: FreeIo, options: ConstituentsWriteOptions): { client: ReturnType<typeof askClient>; repo: string; host: string } | string {
  const target = targetOf(io);
  if (typeof target === 'string') return target;
  const { repo, askUrl } = target;
  const { vars } = io;
  const host = credentialsHost(askUrl);
  const tokens = options.tokens ?? homeTokens({ ...(options.home ? { home: options.home } : {}), omniToken: vars.omniToken?.token ?? null });
  if (!tokens.read(host) && !tokens.omniToken) return `no sign-in for ${host} (omni signin)`;
  return { client: askClient({ baseUrl: askUrl, host, tokens, fetch: options.fetch ?? globalThis.fetch }), repo, host };
}
