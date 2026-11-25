// `omni mission push <n>` — a mission's brief to its page on the Omni app (PRD 2842, s2). It reads
// mission <n>'s folder (`../../lib/mission/folder.ts`), refuses it whole when its mission.md does not
// read through the brief's schema, names another mission, or its mission.html breaks the page rules
// (`invalid mission: <fault>`, one line each, exit 1, nothing sent), then sends both files, titled
// after mission.md's `title`, as a dossier of kind `mission`. The app keeps every version, adding one
// only of a file that changed, and creates or updates the mission's row, in `draft` until a person
// starts it. It prints the page's link and the versions it added, as `omni dossier push` does.
//
// `omni mission push <n> --from <dir>` reads the folder from outside the repository (PRD 3194); `omni mission get <n> [--out <dir>]`
// reads a mission's brief and retros from its page and writes them as plain files, or says `mission <n> not read: <why>` (exit 1).
//
// `omni mission drop <mission> <prd> [--keep]` (PRD 2896 s7) asks the Omni app to take a PRD off its mission's branch: its commit leaves
// the branch by rebase on the mission's next run, its feature pull request is reopened, and the default branch is never changed. It
// prints what leaves and what shares the territory: the later PRDs on the branch that share the PRD's territory go with it unless
// `--keep`. A person runs it; it needs their sign-in, and the app refuses a PRD that is not on the branch.
//
// `omni mission overturn <mission> <decision>` (PRD 2896 s11) overturns a decision the fleet's committee carried at `alone`:
// `<decision>` is a PRD's number (its approval) or `<prd>/<item>` (the answer to one of its items). The decision stays as recorded and
// the person's is added beside it; the PRD leaves the mission branch when it had joined. A person runs it, with their sign-in.
//
// `omni mission send-back <mission> <prd>` (bug #3302) sends a PM product PRD (`<key>-<n>`) that waits on a person after its review back to
// the PM: one more PM round with the Architect's latest open points, the rounds counted again. The person's own event is added; no
// decision is edited. A person runs it, with their sign-in.
//
// `omni mission request <id>` (PRD omni-loop-24 s5) prints a mission request's fleet and goal, read from the page, for `/omni:mission --request`.
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
import { parsePrd, ProductPrdIdSchema, type IssueNumber, type PrdNumber } from '../../lib/ids.ts';
import { dropWords } from '../../lib/mission/drop.ts';
import { folderName, readExport, writeExport } from '../../lib/mission/get.ts';
import { overturnWords, parseRef } from '../../lib/mission/overturn.ts';
import { sentBackWords } from '../../lib/mission/send-back.ts';
import { isRequestId, readRequest, requestLines } from '../../lib/mission/request.ts';
import { readMissionFolder, readMissionFolderAt } from '../../lib/mission/folder.ts';
import type { MissionFolder } from '../../lib/mission/folder.ts';
import { join, resolve } from 'node:path';
import { issueArg, parseArgs, prdArg, println, usageError } from '../args.ts';
import { addedLine } from './dossier.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

/** What a test hands `omni mission` beyond `main()`'s own. */
type MissionOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };
type Io = FreeIo & MissionOptions;
/** Where a push goes: the signed-in client, and the repository. */
type Target = { client: ReturnType<typeof askClient>; repo: string };

const USAGE = 'usage: omni mission push <n> [--from <dir>] | omni mission get <n> [--out <dir>] | omni mission drop <mission> <prd> [--keep] | omni mission overturn <mission> <decision> | omni mission send-back <mission> <prd> | omni mission request <id>';

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

/** The app's reply to `call` on the signed-in client, or the exit code of the one line that says why there is none. */
async function ask(io: Io, call: (target: Target) => Promise<unknown>): Promise<{ reply: unknown } | number> {
  const target = connect(loadContext(io.cwd, { exec: io.exec }), io);
  if (typeof target === 'string') return stopped(io, [target]);
  const sent = await call(target).then((reply: unknown) => ({ reply }), skipLine);
  return typeof sent === 'string' ? stopped(io, [sent]) : sent;
}

/** `push <n> [--from <dir>]`: mission n's folder (`dir`, or the repository's), read whole, then sent. */
async function push(issue: IssueNumber, from: string | null, io: Io): Promise<number> {
  const ctx = loadContext(io.cwd, { exec: io.exec });
  const read = from === null ? readMissionFolder(ctx, issue) : readMissionFolderAt(resolve(io.cwd, from), from, issue);
  if (!read) throw usageError(from === null ? `omni mission push: mission ${issue} has no folder under ${ctx.layout.dirs.missions}.` : `omni mission push: ${from} is not a folder.`);
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

/** `get <n> [--out <dir>]`: mission n read from its page and written as plain files, uncommitted; the folder is printed. */
async function get(issue: IssueNumber, out: string | null, io: Io): Promise<number> {
  const ctx = loadContext(io.cwd, { exec: io.exec });
  const target = connect(ctx, io);
  if (typeof target === 'string') return stopped(io, [`mission ${issue} not read: ${target}`]);
  const sent = await target.client.getMission({ repo: target.repo, mission: issue })
    .then((reply: unknown) => ({ reply }), (error: unknown) => (error instanceof AskCallError && error.status === 404 ? 'missing' : skipLine(error)));
  if (sent === 'missing') return stopped(io, [`no mission #${issue} on the page`]);
  if (typeof sent === 'string') return stopped(io, [`mission ${issue} not read: ${sent}`]);
  const read = readExport(sent.reply);
  if (!read) return stopped(io, [`mission ${issue} not read: refused (no mission in the reply)`]);
  const dir = out === null ? join(ctx.root, ctx.layout.dirs.missions, folderName(issue, read.record)) : resolve(io.cwd, out);
  writeExport(dir, read);
  println(io.stdout, dir);
  return 0;
}

const numbers = (value: unknown): number[] => (Array.isArray(value) ? value.filter((one): one is number => typeof one === 'number') : []);

/** `drop <mission> <prd> [--keep]`: the ask sent, then what leaves the branch and what shares its territory. */
async function drop(mission: IssueNumber, prd: PrdNumber, keep: boolean, io: Io): Promise<number> {
  const sent = await ask(io, ({ client, repo }) => client.dropMission({ repo, mission, prd, keep }));
  if (typeof sent === 'number') return sent;
  const dropped = field(sent.reply, 'drop');
  const branch = field(dropped, 'branch');
  if (!isText(branch)) return stopped(io, ['refused (no drop in the reply)']);
  const sharing = numbers(field(dropped, 'sharing')).map((one) => parsePrd(one));
  const leaves = numbers(field(dropped, 'dropped')).map((one) => parsePrd(one));
  for (const line of dropWords({ branch, set: { prd, sharing, dropped: leaves }, keep })) println(io.stdout, line);
  return 0;
}

/** `overturn <mission> <decision>`: the overturn sent, then what it changes. */
async function overturn(mission: IssueNumber, decision: string, io: Io): Promise<number> {
  const ref = parseRef(decision);
  if (ref === null) throw usageError(`omni mission overturn: <decision> is a PRD's number (its approval) or <prd>/<item> (an item's answer), not "${decision}".`);
  const sent = await ask(io, ({ client, repo }) => client.overturnMission({ repo, mission, decision }));
  if (typeof sent === 'number') return sent;
  const overturned = field(sent.reply, 'overturn');
  if (!isText(field(overturned, 'decision'))) return stopped(io, ['refused (no overturn in the reply)']);
  const branch = field(overturned, 'branch');
  for (const line of overturnWords({ ref, branch: isText(branch) ? branch : null, onBranch: field(overturned, 'onBranch') === true })) println(io.stdout, line);
  return 0;
}

/** `send-back <mission> <prd>`: a PM product PRD sent back to the PM, then what happens next. */
async function sendBack(mission: IssueNumber, id: string, io: Io): Promise<number> {
  const prd = ProductPrdIdSchema.safeParse(id);
  if (!prd.success) throw usageError(`omni mission send-back: <prd> is a product PRD's id (<key>-<n>), not "${id}".`);
  const sent = await ask(io, ({ client, repo }) => client.sendBackMission({ repo, mission, prd: prd.data }));
  if (typeof sent === 'number') return sent;
  if (!isText(field(field(sent.reply, 'sentBack'), 'prd'))) return stopped(io, ['refused (no send-back in the reply)']);
  for (const line of sentBackWords(prd.data, mission)) println(io.stdout, line);
  return 0;
}

/** `request <id>`: the goal and fleet of a mission request the New mission box saved, as the page answers the caller. */
async function request(id: string, io: Io): Promise<number> {
  if (!isRequestId(id)) throw usageError(`omni mission request: <id> is a mission request's uuid, not "${id}".`);
  const sent = await ask(io, ({ client }) => client.readMissionRequest(id));
  if (typeof sent === 'number') return sent;
  const read = readRequest(sent.reply);
  if (read === null) return stopped(io, ['refused (no request in the reply)']);
  for (const line of requestLines(read)) println(io.stdout, line);
  return 0;
}

export const mission = {
  withoutContext: true,
  run(args: string[], io: Io) {
    const { positional, flags } = parseArgs('mission', args, { booleans: ['keep'], values: ['from', 'out'] });
    const [verb, ...operands] = positional;
    const keep = flags.keep === true;
    const { from = null, out = null } = flags;
    const verbs: Record<string, () => Promise<number>> = {
      'push 1': () => push(issueArg('mission push', '<n>', operands[0]), typeof from === 'string' ? from : null, io),
      'get 1': () => get(issueArg('mission get', '<n>', operands[0]), typeof out === 'string' ? out : null, io),
      'drop 2': () => drop(issueArg('mission drop', '<mission>', operands[0]), prdArg('mission drop', '<prd>', operands[1]), keep, io),
      'overturn 2': () => overturn(issueArg('mission overturn', '<mission>', operands[0]), operands[1] ?? '', io),
      'send-back 2': () => sendBack(issueArg('mission send-back', '<mission>', operands[0]), operands[1] ?? '', io),
      'request 1': () => request(operands[0] ?? '', io),
    };
    const run = verbs[`${verb ?? ''} ${String(operands.length)}`];
    if (run === undefined || (keep && verb !== 'drop')) throw usageError(USAGE);
    return run();
  },
} satisfies FreeCommand;
