// `omni worktrees list [--json] | prune [--prd <n>] [--dry-run] | remove <path> | hint` (PRD 2485): the
// kit removes the worktrees it creates, and only once their work is safe on the remote. The rules —
// which worktrees are the kit's, and why one is kept — are `kit/lib/worktrees/engine.ts`'s; this file
// reads the repository, the board and the processes for them, and prints.
//
// - `list` prints every worktree, `kit` or `other`, and each kit one's verdict, `safe` or
//   `kept: <reason>`; `--json` the same as one document.
// - `prune` removes every safe kit worktree (of PRD `<n>` alone with `--prd`), one `removed <path> ·
//   <size>` or `kept <path> · <reason>` line per kit worktree, then `freed <total>`; `--dry-run`
//   removes nothing and prints `would remove` and `would free`.
// - `remove <path>` applies the same rules to one worktree, a detached one under the folder included.
// - `hint` prints `<k> worktrees of the kit can be removed: omni worktrees prune`, or nothing: no
//   fetch, no board, no process read, no size. A session's start runs it.
//
// It runs before a context exists, so that a test hands it `board` (a PRD's board, else the Omni
// page's through `buildBoard`) and `processes` (the processes' working directories, else the
// machine's). Every verb exits 0 whatever it keeps; 1, with one line on stderr, when the repository
// cannot be read; 2 on a malformed call.
import { join } from 'node:path';
import type { Context } from '../../lib/context.ts';
import { loadContext } from '../../lib/context.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { prdFoldersIn, parseFolderName } from '../../lib/layout.ts';
import { boardReads } from '../../lib/loop-reads/port.ts';
import { listWorktrees, pruneWorktrees, removeWorktree, worktreesHint } from '../../lib/worktrees/engine.ts';
import type { BoardSeam, WorktreeBoard, WorktreesSeams } from '../../lib/worktrees/engine.ts';
import { gitHost, processCwds } from '../../lib/worktrees/host.ts';
import { errorMessage, parseArgs, prdArg, println, repoSlug, usageError } from '../args.ts';
import type { FreeCommand, Out } from '../io.ts';
import { buildBoard, loopReadsFor } from './board.ts';
import type { TargetsIo } from './board.ts';

const USAGE = 'usage: omni worktrees list [--json] | prune [--prd <n>] [--dry-run] | remove <path> | hint';

/** What `omni worktrees` is handed: a free command's io, and the two seams a test injects. */
type WorktreesIo = TargetsIo & {
  board?: BoardSeam | undefined;
  processes?: (() => readonly string[] | null) | undefined;
};

/** A verb's parsed call: what it needs from its arguments. */
type Call =
  | { verb: 'list'; json: boolean }
  | { verb: 'prune'; prd: PrdNumber | null; dryRun: boolean }
  | { verb: 'remove'; path: string }
  | { verb: 'hint' };

/** Each verb's reading of its arguments: its call, or `null` when they do not fit it. */
const VERBS: Readonly<Record<string, (command: string, rest: readonly string[]) => Call | null>> = {
  list(command, rest) {
    const { positional, flags } = parseArgs(command, rest, { booleans: ['json'] });
    return positional.length === 0 ? { verb: 'list', json: flags.json === true } : null;
  },
  prune(command, rest) {
    const { positional, flags } = parseArgs(command, rest, { values: ['prd'], booleans: ['dry-run'] });
    if (positional.length !== 0) return null;
    return { verb: 'prune', prd: flags.prd === undefined ? null : prdArg(command, '--prd', flags.prd), dryRun: flags['dry-run'] === true };
  },
  remove(command, rest) {
    const [path, ...more] = parseArgs(command, rest).positional;
    return path === undefined || more.length > 0 ? null : { verb: 'remove', path };
  },
  hint: (command, rest) => (parseArgs(command, rest).positional.length === 0 ? { verb: 'hint' } : null),
};

/** `args` as a call, or a usage error: read before the repository is. */
function callOf(args: readonly string[]): Call {
  const [verb = '', ...rest] = args;
  const parse = Object.hasOwn(VERBS, verb) ? VERBS[verb] : undefined;
  const call = parse === undefined ? null : parse(`worktrees ${verb}`, rest);
  if (call === null) throw usageError(`omni worktrees: ${USAGE}`);
  return call;
}

/** The PRD whose folder, in the inbox or shipped, carries `topic`; `null` when this checkout has none. */
function prdOfTopic(ctx: Context): (topic: string) => PrdNumber | null {
  const { inbox, shipped } = ctx.layout.dirs;
  const folders = [...prdFoldersIn(join(ctx.root, inbox)), ...prdFoldersIn(join(ctx.root, shipped))];
  return (topic) => folders.find(({ name }) => parseFolderName(name)?.topic === topic)?.prd ?? null;
}

/**
 * PRD `prd`'s board, as `omni board` builds it, and whether its feature PR is still open: open while
 * any landing branch has no pull request yet, or an open one. One line saying why when it cannot be read.
 */
function omniBoard(ctx: Context, io: WorktreesIo): BoardSeam {
  return async (prd) => {
    try {
      const reads = loopReadsFor(ctx, io);
      const built = await buildBoard(prd, { ctx, reads: boardReads(reads), exec: io.exec });
      const repo = repoSlug('worktrees', ctx, undefined);
      const perLanding = await Promise.all(built.landings.map(({ branch }) => reads.changes({ repo, state: 'all', head: branch })));
      const featureOpen = perLanding.some((changes) => changes.length === 0 || changes.some(({ state }) => state === 'open' || state === 'draft'));
      const board: WorktreeBoard = { featureOpen, slices: Object.fromEntries(built.result.slices.map((row) => [row.id, row.state])) };
      return board;
    } catch (error) {
      return errorMessage(error).split('\n')[0] ?? 'the board cannot be read';
    }
  };
}

/** The `list` verb's text: one line per worktree. */
function printList(stdout: Out, entries: Awaited<ReturnType<typeof listWorktrees>>): void {
  for (const entry of entries) {
    const branch = entry.branch ?? 'detached';
    const verdict = entry.verdict === null ? '' : ` · ${entry.verdict}`;
    println(stdout, `${entry.kind.padEnd(5)}  ${entry.path} · ${branch}${verdict}`);
  }
}

async function runCall(call: Call, seams: WorktreesSeams, { stdout, cwd }: { stdout: Out; cwd: string }): Promise<void> {
  if (call.verb === 'list') {
    const entries = await listWorktrees(seams);
    if (call.json) println(stdout, JSON.stringify({ worktrees: entries }, null, 2));
    else printList(stdout, entries);
  } else if (call.verb === 'prune') {
    for (const line of await pruneWorktrees(seams, { prd: call.prd, dryRun: call.dryRun })) println(stdout, line);
  } else if (call.verb === 'remove') {
    println(stdout, await removeWorktree(seams, { path: call.path, cwd }));
  } else {
    const hint = await worktreesHint(seams);
    if (hint !== null) println(stdout, hint);
  }
}

export const worktrees = {
  withoutContext: true,
  async run(args: string[], io: WorktreesIo): Promise<number> {
    const call = callOf(args);
    try {
      const ctx = loadContext(io.cwd, { exec: io.exec });
      const seams: WorktreesSeams = {
        host: gitHost({ root: ctx.root, remote: ctx.config.repo.remote, exec: io.exec, cwds: io.processes ?? (() => processCwds(process.platform, io.exec)) }),
        board: io.board ?? omniBoard(ctx, io),
        branches: ctx.config.branches,
        folder: ctx.config.worktrees,
        prdOf: prdOfTopic(ctx),
      };
      await runCall(call, seams, { stdout: io.stdout, cwd: io.cwd });
      return 0;
    } catch (error) {
      println(io.stderr, `omni worktrees: ${errorMessage(error).split('\n')[0] ?? 'the repository cannot be read'}`);
      return 1;
    }
  },
} satisfies FreeCommand;
