// `omni approval <n> [--json]` (PRD 1299, s4): reads PRD n's approval in force on the Omni page
// (`GET /api/dossiers/approval`), with the terminal's sign-in, and judges it against the files of the
// tree this checkout holds (`kit/lib/approval/approval.ts`): approved, pending, drifted, unreachable
// or refused, one line each (a drifted file per line). It exits 0 on approved and 1 on every other
// state, the line printed either way; with no Omni page set or no sign-in it holds the PRD as
// unreachable and says why on stderr. `--json` prints the state, who approved and when, whether they
// are a member today, the dossier's link, the pinned files, what drifted and the lines.
//
// `omni approval restore <n>` (PRD 1612, s1) reads the same approval and writes each drifted file
// back from the pinned version's content the server sent, checked against its sha256 first
// (`kit/lib/approval/restore.ts`), one line per file. It exits 0 when every drifted file was written
// back (or nothing drifted), 1 otherwise. It never commits and never pushes.
//
// `omni approval flag [--json]` (item s7-01) reads this repository's phase-0 flag on the Omni page
// instead: `phase 0: server` or `phase 0: pr`, exit 0; or, when it cannot be read,
// `phase 0: pr · the flag could not be read: <why>`, exit 1. `/omni:brainstorm` reads it at step 0.
//
// `omni approval tech request <n> --to <login>` (PRD 2608, s3) names one member for PRD n's Tech Approval
// (`kit/lib/approval/tech.ts`) and prints who it now waits on; with no `--to` it prints the workspace's
// members, one per line. A refusal prints in the database's own words, exit 1.
//
// It runs before a context exists, like `decide`, so that a test can hand it `tokens` (the token
// store), `home` (where the real one lives), `fetch` and `callMs`; it loads the context itself.
import { readFlag } from '../../lib/approval/flag.ts';
import type { FlagReading } from '../../lib/approval/flag.ts';
import { approvalReader } from '../../lib/approval/prd-state.ts';
import type { ApprovalReading } from '../../lib/approval/approval.ts';
import { checkoutWriter, restoreDrift } from '../../lib/approval/restore.ts';
import type { Restored } from '../../lib/approval/restore.ts';
import { listTechMembers, sendTechRequest } from '../../lib/approval/tech.ts';
import { SIGNED_OUT_LINE } from '../../lib/approval/wait.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';
import type { PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni approval <n> [--json] · omni approval restore <n> · omni approval flag [--json] · omni approval tech request <n> [--to <login>]';

/** The flag's line, as `omni approval flag` prints it. */
const flagLine = ({ flag, why }: FlagReading): string =>
  why === null ? `phase 0: ${flag}` : `phase 0: ${flag} · the flag could not be read: ${why}`;

/** What a test hands `omni approval` beyond `main()`'s own. */
type ApprovalOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };

/** The reading as `--json` prints it. */
function shown(prd: PrdNumber, reading: ApprovalReading) {
  const { approval } = reading;
  return {
    prd: Number(prd),
    state: reading.state,
    approver: approval?.approver.login ?? null,
    member: approval?.approver.member ?? null,
    at: approval?.approvedAt ?? null,
    url: reading.url,
    files: approval?.files ?? [],
    drift: reading.drift,
    lines: reading.lines,
    ...(reading.tech ? { tech: reading.tech } : {}),
  };
}

function report(stdout: Out, prd: PrdNumber, reading: ApprovalReading, json: boolean): void {
  println(stdout, json ? JSON.stringify(shown(prd, reading)) : reading.lines.join('\n'));
}

/** What `omni approval` was asked: the flag, a PRD's approval, a restore of it, or a Tech Approval's request. */
type Asked = { what: 'flag' } | { what: 'read' | 'restore' | 'tech'; prd: PrdNumber };

function askedOf(positional: string[]): Asked {
  const [first, second] = positional;
  if (first === 'tech') {
    if (second !== 'request' || positional.length !== 3) throw usageError(USAGE);
    return { what: 'tech', prd: prdArg('approval', '<n>', positional[2]) };
  }
  if (first === 'restore' && positional.length === 2) return { what: 'restore', prd: prdArg('approval', '<n>', second) };
  if (positional.length !== 1) throw usageError(USAGE);
  return first === 'flag' ? { what: 'flag' } : { what: 'read', prd: prdArg('approval', '<n>', first) };
}

/** What one run has to hand: the checkout, its repository, and how to reach the page. */
type Run = {
  ctx: ReturnType<typeof loadContext>;
  repo: string;
  stdout: Out;
  stderr: Out;
  tokens: TokenStore | undefined;
  home: string | undefined;
  fetch: Fetch;
  callMs: number | undefined;
};

/** `omni approval flag`: prints where this repository's new PRDs are born. */
async function showFlag({ ctx, repo, stdout, tokens, home, fetch, callMs }: Run, json: boolean): Promise<number> {
  const reading = await readFlag(ctx.config.ask.url, { repo, tokens, home, fetch, callMs });
  println(stdout, json ? JSON.stringify(reading) : flagLine(reading));
  return reading.why === null ? 0 : 1;
}

/** `omni approval <n>` and `omni approval restore <n>`: the approval in force, read or written back. */
async function readOrRestore({ ctx, repo, stdout, stderr, tokens, home, fetch, callMs }: Run, what: 'read' | 'restore', prd: PrdNumber, json: boolean): Promise<number> {
  const reading = await approvalReader(ctx, { repo, tokens, home, fetch, callMs })(prd);
  if ('why' in reading) println(stderr, `omni approval: ${String(reading.why)}`);
  if (what === 'restore') return restore(stdout, restoreDrift(reading, checkoutWriter(ctx, prd)));
  report(stdout, prd, reading, json);
  return reading.state === 'approved' ? 0 : 1;
}

export const approval = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs }: FreeIo & ApprovalOptions) {
    const { positional, flags } = parseArgs('approval', args, { booleans: ['json'], values: ['to'] });
    const asked = askedOf(positional);
    const ctx = loadContext(cwd, { exec });
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError('omni approval: no repository slug — set repo.slug in the config.');
    const run: Run = { ctx, repo, stdout, stderr, tokens, home, fetch, callMs };
    const json = Boolean(flags.json);
    if (asked.what === 'flag') return showFlag(run, json);
    if (!ctx.layout.whereIs(asked.prd)) {
      println(stderr, `omni approval: PRD ${Number(asked.prd)} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    return asked.what === 'tech' ? tech(run, asked.prd, flags.to) : readOrRestore(run, asked.what, asked.prd, json);
  },
} satisfies FreeCommand;

/** `omni approval tech request`: names `to` for the PRD's Tech Approval, or lists who can be named. */
async function tech({ ctx, repo, stdout, stderr, tokens, home, fetch, callMs }: Run, prd: PrdNumber, to: string | undefined): Promise<number> {
  const askUrl = ctx.config.ask.url;
  const client = askUrl ? signedInClient({ askUrl, tokens, home, fetch, callMs }) : null;
  if (!client) {
    println(stderr, `omni approval: ${askUrl ? SIGNED_OUT_LINE : 'no Omni page is set here (ask.url) · held'}`);
    return 1;
  }
  const result = await (to === undefined ? listTechMembers(client, repo, prd) : sendTechRequest(client, repo, prd, to));
  if (!result.ok) {
    println(stderr, `omni approval: ${result.why}`);
    return 1;
  }
  if (result.lines.length > 0) println(stdout, result.lines.join('\n'));
  return 0;
}

/** Prints what a restore did, one line per file: 0 when every drifted file was written back. */
function restore(stdout: Out, restored: Restored): number {
  println(stdout, restored.lines.join('\n'));
  return restored.ok ? 0 : 1;
}
