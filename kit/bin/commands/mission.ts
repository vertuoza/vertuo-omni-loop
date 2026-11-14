// `omni mission push <n>` — a mission's brief to its page on the Omni app (PRD 2842, s2). It reads
// mission <n>'s folder (`../../lib/mission/folder.ts`), refuses it whole when its mission.md does not
// read through the brief's schema, names another mission, or its mission.html breaks the page rules
// (`invalid mission: <fault>`, one line each, exit 1, nothing sent), then sends both files, titled
// after mission.md's `title`, as a dossier of kind `mission`. The app keeps every version, adding one
// only of a file that changed, and creates or updates the mission's row, in `draft` until a person
// starts it. It prints the page's link and the versions it added, as `omni dossier push` does.
//
// It never blocks the skill that runs it: every call has the contract's 5-second limit and one token
// refresh, and anything that stops it is exit 1 with one line — `off`, `no sign-in (omni signin)`,
// `unreachable`, `refused (<status>)` or `refused (<status>): <the server's reason>`. Exit 2 is the kit
// not installed here, a config that does not read, or arguments it cannot run.
//
// It runs before a context exists, as `omni dossier` does, so that a test can hand it `tokens`,
// `home`, `fetch` and `callMs`; it loads the context itself.
import { AskCallError } from '../../lib/ask/client.ts';
import type { askClient, Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import type { Context } from '../../lib/context.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { readMissionFolder } from '../../lib/mission/folder.ts';
import type { MissionFolder } from '../../lib/mission/folder.ts';
import { issueArg, parseArgs, println, usageError } from '../args.ts';
import { addedLine } from './dossier.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

/** What a test hands `omni mission` beyond `main()`'s own. */
type MissionOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };
type Io = FreeIo & MissionOptions;
/** Where a push goes: the signed-in client, and the repository. */
type Target = { client: ReturnType<typeof askClient>; repo: string };

const USAGE = 'usage: omni mission push <n>';

/** The one line a failed call is reported with: a refusal carries the server's reason when it gave one. */
function skipLine(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.reason ? `refused (${error.status}): ${error.reason}` : `refused (${error.status})`;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Where a push goes, or the one line that says why it goes nowhere. */
function connect(ctx: Context, { tokens, home, fetch = globalThis.fetch, callMs }: Io): Target | string {
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) return 'off';
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni mission: no repository slug — set repo.slug in the config.');
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  return client ? { client, repo } : 'no sign-in (omni signin)';
}

/** The app's reply to the folder, or the one line that says why it did not take it. */
function send(folder: MissionFolder, { client, repo }: Target): Promise<{ reply: unknown } | string> {
  const artifacts = folder.artifacts.map(({ kind, content }) => ({ kind, content }));
  return client.pushDossier({ repo, prd: folder.mission, kind: 'mission', title: folder.brief.title, artifacts })
    .then((reply: unknown) => ({ reply }), skipLine);
}

/** Prints `lines` on stderr; the exit code of a push that stopped. */
function stopped(io: Io, lines: readonly string[]): number {
  for (const line of lines) println(io.stderr, line);
  return 1;
}

/** `push <n>`: mission n's folder, read whole, then sent. */
async function push(issue: IssueNumber, io: Io): Promise<number> {
  const ctx = loadContext(io.cwd, { exec: io.exec });
  const read = readMissionFolder(ctx, issue);
  if (!read) throw usageError(`omni mission push: mission ${issue} has no folder under ${ctx.layout.dirs.missions}.`);
  if (!read.ok) return stopped(io, read.errors.map((error) => `invalid mission: ${error}`));
  const target = connect(ctx, io);
  if (typeof target === 'string') return stopped(io, [target]);
  const sent = await send(read.folder, target);
  if (typeof sent === 'string') return stopped(io, [sent]);
  const url = field(sent.reply, 'url');
  if (!isText(field(sent.reply, 'id')) || !isText(url)) return stopped(io, ['refused (no page in the reply)']);
  println(io.stdout, url);
  println(io.stdout, addedLine({ added: field(sent.reply, 'added'), unchanged: field(sent.reply, 'unchanged') }));
  return 0;
}

export const mission = {
  withoutContext: true,
  run(args: string[], io: Io) {
    const { positional } = parseArgs('mission', args);
    const [verb, number, ...rest] = positional;
    if (verb !== 'push' || rest.length > 0) throw usageError(USAGE);
    return push(issueArg('mission push', '<n>', number), io);
  },
} satisfies FreeCommand;
