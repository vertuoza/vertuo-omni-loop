// `omni rewind facts <n>` and `omni rewind push <n> --file <findings.json>` (PRD 2410, s5): what the main
// watch recorded for a PRD, and the rewind's findings sent to the PRD's page, through `/api/rewind/*`
// with the terminal's sign-in (`omni signin`, or OMNI_TOKEN).
//
//   omni rewind facts <n> [--json]            the PRD's status per repository, each break, the findings so far
//   omni rewind push <n> --file <file>        sends the findings; refused, naming the finding, one with no
//                                             evidence link, an origin other than repository, omni-setup or
//                                             knowledge, a check other than the eight, or one already proposed
//   omni rewind outcome <finding> (--pr <n> | --already <rule> | --asks <question>)
//                                             PRD 2498, s2: records, once, what /omni:rewind-apply did with an
//                                             approved finding; refused one with no value, with two, or a
//                                             second outcome of the same finding
//
// All exit 0 when done, 1 when refused or unreachable (one line, nothing sent when the file is refused
// here), 2 on a usage error. `push` reads the file and checks it before any call.
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { factLines, factsOf } from '../../lib/rewind/facts.ts';
import { checkFindings } from '../../lib/rewind/findings.ts';
import { FindingIdSchema, outcomeLine, outcomeOf } from '../../lib/rewind/outcome.ts';
import type { RewindOutcome } from '../../lib/rewind/outcome.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

type RewindOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined };

const USAGE = [
  'usage: omni rewind facts <prd> [--json] | omni rewind push <prd> --file <findings.json>',
  "       | omni rewind outcome <finding> (--pr <n> | --already <rule> | --asks '<question>')",
].join('\n');

/** The one line a failed call says, in the server's own words when it gave them. */
function refusalLine(error: unknown, host: string): string {
  if (!(error instanceof AskCallError)) throw error;
  const { status, reason } = error;
  if (status === 401) return 'the sign-in was refused (omni signin)';
  if (status !== null) return reason ?? `refused (${String(status)})`;
  return error.message.startsWith('not signed in') ? `no sign-in for ${host} (omni signin)` : 'the Omni page could not be reached';
}

type Reached = { client: ReturnType<typeof askClient>; repo: string; host: string };

/** This checkout's loaded kit, or the one line saying why there is none. */
function kitOf({ cwd, exec }: FreeIo): ReturnType<typeof loadContext> | string {
  try {
    return loadContext(cwd, { exec });
  } catch (error) {
    if (error instanceof Error && error.name === 'ConfigError') return error.message.split('\n')[0] ?? 'the kit is not set up here';
    throw error;
  }
}

/** This checkout's repository and Omni page, or the one line saying why it has none. */
function pageOf(io: FreeIo): { askUrl: string; repo: string } | string {
  const kit = kitOf(io);
  if (typeof kit === 'string') return kit;
  const askUrl = kit.config.ask.url;
  const repo = kit.config.repo.slug;
  if (!askUrl) return 'no Omni page is set here (ask.url)';
  return repo ? { askUrl, repo } : 'no repository slug: set repo.slug in the config';
}

/** This checkout's repository and the client to its Omni page, or the one line saying why there is none. */
function reach(io: FreeIo, options: RewindOptions): Reached | string {
  const page = pageOf(io);
  if (typeof page === 'string') return page;
  const host = credentialsHost(page.askUrl);
  const tokens = options.tokens ?? homeTokens({ ...(options.home ? { home: options.home } : {}), omniToken: io.vars.omniToken?.token ?? null });
  if (!tokens.read(host) && !tokens.omniToken) return `no sign-in for ${host} (omni signin)`;
  return { client: askClient({ baseUrl: page.askUrl, host, tokens, fetch: options.fetch ?? globalThis.fetch }), repo: page.repo, host };
}

/** The file's JSON, or the line saying why it cannot be read. */
function fileJson(cwd: string, name: string): { value: unknown } | { error: string } {
  const path = isAbsolute(name) ? name : join(cwd, name);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { error: `cannot read ${name}.` };
  }
  try {
    const value: unknown = JSON.parse(text);
    return { value };
  } catch {
    return { error: `${name} is not JSON.` };
  }
}

/** The refusal of `omni rewind <verb>`: one line on stderr, `tail` after it, exit 1. */
function stopper(io: FreeIo, verb: string, tail = ''): (line: string) => number {
  return (line) => {
    println(io.stderr, `omni rewind ${verb}: ${line}${tail}`);
    return 1;
  };
}

/** Runs `work` against this checkout's Omni page; a failed call, or no page, is `stop`'s one line. */
async function onPage(io: FreeIo, options: RewindOptions, stop: (line: string) => number, work: (reached: Reached) => Promise<number>): Promise<number> {
  const reached = reach(io, options);
  if (typeof reached === 'string') return stop(reached);
  try {
    return await work(reached);
  } catch (error) {
    return stop(refusalLine(error, reached.host));
  }
}

async function facts(prd: PrdNumber, json: boolean, io: FreeIo, options: RewindOptions): Promise<number> {
  const stop = stopper(io, 'facts');
  return onPage(io, options, stop, async ({ client, repo }) => {
    const read = factsOf(await client.readRewind({ repo, prd }));
    if (!read) return stop('the Omni page answered something this kit does not read');
    if (json) println(io.stdout, JSON.stringify(read));
    else for (const line of factLines(prd, read)) println(io.stdout, line);
    return 0;
  });
}

async function push(prd: PrdNumber, file: string, io: FreeIo, options: RewindOptions): Promise<number> {
  const stop = stopper(io, 'push', ' Nothing sent.');
  const sent = fileJson(io.cwd, file);
  if ('error' in sent) return stop(sent.error);
  const checked = checkFindings(sent.value);
  if (!checked.ok) return stop(checked.error);
  return onPage(io, options, stop, async ({ client, repo }) => {
    await client.pushRewind({ repo, prd, findings: checked.findings });
    println(io.stdout, `rewind push — PRD ${String(prd)}: ${String(checked.findings.length)} finding(s) sent to its page, proposed for a member to approve or reject.`);
    return 0;
  });
}

async function outcome(finding: string, sent: RewindOutcome, io: FreeIo, options: RewindOptions): Promise<number> {
  const body = sent.outcome === 'proposed' ? { outcome: sent.outcome, pr: sent.pr } : { outcome: sent.outcome, note: sent.note };
  return onPage(io, options, stopper(io, 'outcome', ' Nothing recorded.'), async ({ client }) => {
    await client.outcomeRewind({ finding, body });
    println(io.stdout, outcomeLine(finding, sent));
    return 0;
  });
}

/** The finding and outcome `omni rewind outcome` was given, or a usage error. */
function outcomeArgs(rest: string[]): { finding: string; sent: RewindOutcome } {
  const { positional, flags } = parseArgs('rewind', rest, { values: ['pr', 'already', 'asks'] });
  const [finding] = positional;
  if (positional.length !== 1 || finding === undefined) throw usageError(USAGE);
  if (!FindingIdSchema.safeParse(finding).success) throw usageError('omni rewind outcome: the finding is the id on its card (a UUID).');
  const named = outcomeOf({ pull: flags.pr, already: flags.already, asks: flags.asks });
  if (!named.ok) throw usageError(`omni rewind outcome: ${named.error}`);
  return { finding, sent: named.value };
}

export const rewind = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & RewindOptions): Promise<number> {
    const [verb, ...rest] = args;
    const { tokens, home, fetch } = io;
    const options = { tokens, home, fetch };
    if (verb === 'facts') {
      const { positional, flags } = parseArgs('rewind', rest, { booleans: ['json'] });
      const [prdText] = positional;
      if (positional.length !== 1) throw usageError(USAGE);
      return facts(prdArg('rewind', 'the PRD', prdText), flags.json === true, io, options);
    }
    if (verb === 'push') {
      const { positional, flags } = parseArgs('rewind', rest, { values: ['file'] });
      const [prdText] = positional;
      if (positional.length !== 1 || flags.file === undefined) throw usageError(USAGE);
      return push(prdArg('rewind', 'the PRD', prdText), flags.file, io, options);
    }
    if (verb === 'outcome') {
      const { finding, sent } = outcomeArgs(rest);
      return outcome(finding, sent, io, options);
    }
    throw usageError(USAGE);
  },
} satisfies FreeCommand;
