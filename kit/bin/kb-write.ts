// `omni kb legal add | edit` and `omni kb glossary add | edit` (PRD 2268, s2): add or edit one Legal
// entry or one Glossary term of this repository's product from the terminal, through
// `POST /api/knowledge/changes` with the terminal's sign-in (`omni signin`, or OMNI_TOKEN). The rules
// are the Knowledge tab's: the section's owner or delegate saves directly, any other member proposes.
//
//   omni kb legal add --code <CODE> --statement "<text>" --source "<law>"
//   omni kb legal edit <id> [--statement "<text>"] [--source "<law>"]
//   omni kb glossary add --term "<term>" --meaning "<text>" [--avoid <a,b>]
//   omni kb glossary edit "<term>" [--meaning "<text>"] [--avoid <a,b>]
//   each takes --product <name> and --json
//
// One line on success (`added <id> · <url>`, `edited <id> · <url>` or `proposed · waits for @<owner> ·
// <url>`), or with `--json` the route's answer. A refusal, a missing sign-in or an unreachable page is
// one line and exit 1 (with `--json`, `{error}` on stdout); a missing flag, an edit with no field or an
// unknown flag is a usage error, exit 2. No remove and no retire: those stay on the Knowledge tab.
import { askClient, AskCallError } from '../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../lib/ask/client.ts';
import { homeTokens } from '../lib/ask/client-tokens.ts';
import { credentialsHost } from '../lib/ask/credentials.ts';
import { jsonObject } from '../lib/ask/schema.ts';
import type { Context } from '../lib/context.ts';
import { parseArgs, println, usageError } from './args.ts';
import type { Out, Vars } from './io.ts';

/** What a test hands the write beyond the command's own io: the sign-in, the app and the clock of the call. */
export type WriteOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
};

type Kind = 'legal' | 'glossary';
type Action = 'add' | 'edit';

/** The body of one change, as `POST /api/knowledge/changes` takes it, less the repository. */
type Change = { product?: string; kind: Kind; action: Action; entry?: string; fields: Record<string, unknown> };

const USAGE: Record<Kind, string> = {
  legal: 'usage: omni kb legal add --code <CODE> --statement "<text>" --source "<law>" [--product <name>] [--json] | omni kb legal edit <id> [--statement "<text>"] [--source "<law>"] [--product <name>] [--json]',
  glossary: 'usage: omni kb glossary add --term "<term>" --meaning "<text>" [--avoid <a,b>] [--product <name>] [--json] | omni kb glossary edit "<term>" [--meaning "<text>"] [--avoid <a,b>] [--product <name>] [--json]',
};

/** The fields an add must carry, the ones it may carry, and the ones an edit may change (an edit names its item apart). */
const REQUIRED: Record<Kind, readonly string[]> = { legal: ['code', 'statement', 'source'], glossary: ['term', 'meaning'] };
const ADDABLE: Record<Kind, readonly string[]> = { legal: REQUIRED.legal, glossary: ['term', 'meaning', 'avoid'] };
const EDITABLE: Record<Kind, readonly string[]> = { legal: ['statement', 'source'], glossary: ['meaning', 'avoid'] };

/** A text, trimmed, or null when it is absent or blank. */
const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** The avoid words of `--avoid a,b`: trimmed, none empty. */
const wordsOf = (value: string): string[] => value.split(',').map((word) => word.trim()).filter(Boolean);

/** The fields of `names` that `flags` give: text trimmed and never blank, `avoid` a list (empty clears it). */
function fieldsOf(names: readonly string[], flags: Record<string, string | true | undefined>): Record<string, unknown> {
  const given = names.map((name): [string, unknown] => {
    const raw = flags[name];
    if (name !== 'avoid') return [name, textOf(raw)];
    return [name, typeof raw === 'string' ? wordsOf(raw) : null];
  });
  return Object.fromEntries(given.filter(([, value]) => value !== null));
}

/** The flags and positionals of `args`: an unknown flag is a usage error that carries the usage. */
function parsedOf(kind: Kind, args: string[]) {
  const names = [...new Set([...ADDABLE[kind], ...EDITABLE[kind], 'product'])];
  try {
    return parseArgs(`kb ${kind}`, args, { values: names, booleans: ['json'] });
  } catch (error) {
    throw usageError(`${error instanceof Error ? error.message : String(error)} ${USAGE[kind]}`);
  }
}

/** The change `args` asks for, or a `UsageError` saying what is missing or wrong. */
function changeOf(kind: Kind, args: string[]): { change: Change; json: boolean } {
  const usage = USAGE[kind];
  const { positional, flags } = parsedOf(kind, args);
  const [action, ...rest] = positional;
  if (action !== 'add' && action !== 'edit') throw usageError(usage);
  const entry = action === 'edit' ? textOf(rest[0]) : null;
  if (rest.length !== (action === 'edit' ? 1 : 0) || (action === 'edit' && entry === null)) throw usageError(usage);
  const fields = fieldsOf(action === 'add' ? ADDABLE[kind] : EDITABLE[kind], flags);
  if (action === 'add' && REQUIRED[kind].some((name) => !(name in fields))) throw usageError(usage);
  if (action === 'edit' && Object.keys(fields).length === 0) throw usageError(`omni kb ${kind} edit: give at least one field to change. ${usage}`);
  const product = textOf(flags.product);
  const change: Change = { kind, action, ...(product === null ? {} : { product }), ...(entry === null ? {} : { entry }), fields };
  return { change, json: flags.json === true };
}

/** The line a successful change prints, or null when the reply is not one. */
function successLine(action: Action, reply: unknown): string | null {
  const answer = jsonObject(reply);
  if (!answer) return null;
  const [id, url, owner] = [textOf(answer.id), textOf(answer.url), textOf(answer.owner)];
  const link = url === null ? '' : ` · ${url}`;
  if (answer.done === 'proposed') return `proposed · waits for ${owner === null ? "the section's owner" : `@${owner.replace(/^@/, '')}`}${link}`;
  return answer.done === 'applied' && id !== null ? `${action === 'add' ? 'added' : 'edited'} ${id}${link}` : null;
}

/** The one line a failed call says, in the server's own words when it gave them. */
function refusalLine(error: unknown, host: string): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) {
    return error.message.startsWith('not signed in') ? `no sign-in for ${host} (omni signin)` : 'the Omni page could not be reached';
  }
  if (error.status === 401) return 'the sign-in was refused (omni signin)';
  return error.reason ?? `refused (${error.status})`;
}

/** `omni kb legal | glossary add | edit`: see the top of this file. */
export async function knowledgeWrite(
  kind: Kind,
  args: string[],
  { ctx, stdout, stderr, vars }: { ctx: Context; stdout: Out; stderr: Out; vars: Vars },
  options: WriteOptions,
): Promise<number> {
  const { change, json } = changeOf(kind, args);
  const stop = (line: string): number => {
    if (json) println(stdout, JSON.stringify({ error: line }));
    else println(stderr, `omni kb ${kind} ${change.action}: ${line}`);
    return 1;
  };
  const askUrl = ctx.config.ask.url;
  const repo = ctx.config.repo.slug;
  if (!askUrl) return stop('no Omni page is set here (ask.url)');
  if (!repo) return stop('no repository slug — set repo.slug in the config');
  const host = credentialsHost(askUrl);
  const omniToken = vars.omniToken?.token ?? null;
  const tokens = options.tokens ?? homeTokens({ ...(options.home ? { home: options.home } : {}), omniToken });
  if (!tokens.read(host) && !tokens.omniToken) return stop(`no sign-in for ${host} (omni signin)`);
  const client = askClient({ baseUrl: askUrl, host, tokens, fetch: options.fetch ?? globalThis.fetch, ...(options.callMs ? { callMs: options.callMs } : {}) });
  try {
    const reply = await client.changeKnowledge({ repo, ...change });
    const line = successLine(change.action, reply);
    if (line === null) return stop('the Omni page answered something this kit does not read');
    println(stdout, json ? JSON.stringify(reply) : line);
    return 0;
  } catch (error) {
    return stop(refusalLine(error, host));
  }
}
