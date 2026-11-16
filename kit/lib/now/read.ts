// What `omni now` reads (PRD 1208's spec, "What a session is on"): the facts the status line reads
// (`../statusline/facts.ts`, PRD 324) for the session's folder and id, turned into the answer by
// `now.ts`.
//
// The headline (s3, `headline.ts`) is read first: the loop this checkout keeps live or sleeping, or
// the roadmap it drives, else the roadmap the session's record names, which has no work under it.
// Under a running loop whose last tick named a PRD, the work is that PRD, read as a session on its
// feature branch reads it, and what it is doing is that tick. Otherwise the work is read branch
// first, then record, as PRD 324 reads a PRD:
//
// 1. a fix branch (`branches.fix`) whose bug or visual fix has a folder, read by the heartbeat's work
//    finder (PRD 757, `findWork`);
// 2. the PRD the session's branch names, else the one its record names (the status line's own
//    reading), its stage and its board, read from the cached file with each slice's name;
// 3. the bug or visual fix the session's record names (`{ kind, number, at }`, PRD 1208's s2).
//
// A fix's folder is `<nnnn>-<topic>` under `<paths.delivery>/bugs/` or `<paths.delivery>/visual/`, in
// the checkout's working tree or on the base (`<repo.remote>/<repo.defaultBranch>`, else the local
// default branch); it is `merged` once its folder is on the base. A fix, a PRD or a roadmap with no
// folder is none.
//
// The links (s4) are read from the files the background refresh keeps in the main checkout
// (`links.ts`): the work's, and a roadmap headline's; a file missing or 10 minutes old adds none.
// The approval wait (PRD 1322's s5, `wait.ts`) is read from the checkout's waiting files, the work's
// PRD first.
// The sync status (PRD 1990, s6) is read from the cache `omni sync` keeps in the main checkout.
// Nothing here prints, fetches, runs `gh`, writes a file or starts a process: the
// board's background refresh is never started from here. Anything that cannot be read reads as the
// session on nothing; it never throws.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findWork } from '../ask/heartbeat.ts';
import { fillBranch } from '../board.ts';
import { bugRoot } from '../bug/verdict.ts';
import { loadConfig } from '../config.ts';
import { createContext } from '../context.ts';
import type { Context, ExecText } from '../context.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { mainCheckout } from '../dossier/local.ts';
import { findRoot } from '../init/repo.ts';
import { parseFolderName } from '../layout.ts';
import type { NamedSlice } from '../statusline/board-cache.ts';
import { readFacts } from '../statusline/facts.ts';
import type { PrdFacts } from '../statusline/facts.ts';
import type { CachedSlice } from '../statusline/schema.ts';
import { recordedWork } from '../statusline/sessions.ts';
import type { RecordedWork } from '../statusline/sessions.ts';
import { readSyncCache } from '../sync/cache.ts';
import { visualRoot } from '../visual/verdict.ts';
import { roadmapNamed, runningLoop } from './headline.ts';
import { readLinks, readPullRequest } from './links.ts';
import { linked, NOTHING, nowOfFix, nowOfPrd, underHeadline, withSync, withWait } from './now.ts';
import type { FixKind, Now, NowSync, NowWork, WorkStage } from './now.ts';
import { attempt, baseOf, foldersAt, QUIET } from './tree.ts';
import type { Folders } from './tree.ts';
import { readWait } from './wait.ts';
import type { FixStatusFacts, PrdStatusFacts, StatusChecked, StatusFacts, StatusPullRequest as StatusPr } from './status/steps.ts';

/** What every read of one session needs. */
type Reading = { folder: string; sessionId: string | null; exec: ExecText; now: number; base: string | null };

/** `slice` with the name the cached board kept for it, when it kept one. */
function named(slice: CachedSlice): NamedSlice {
  return 'name' in slice && typeof slice.name === 'string' ? { ...slice, name: slice.name } : slice;
}

/** The context of the checkout `folder` sits in, or `null` when it is no repository or its config does not load. */
function contextOf(folder: string, exec: ExecText): Context | null {
  return attempt(() => {
    const root = findRoot(folder, exec);
    return createContext(root, loadConfig(root));
  }, null);
}

/** The answer for the `kind` fix of issue `number`, among its `folders`; `null` when it has no folder. */
function fixNow(kind: FixKind, number: IssueNumber, { checkout, base }: Folders): Now | null {
  const folder = [...checkout, ...base].find((name) => parseFolderName(name)?.prd === number);
  const parsed = folder ? parseFolderName(folder) : null;
  return folder && parsed ? nowOfFix({ kind, number, topic: parsed.topic, merged: base.includes(folder) }) : null;
}

const isFixKind = (kind: string): kind is FixKind => kind === 'bug' || kind === 'visual';

/** The answer for `work` when it is a bug or visual fix, among `fixes`; `undefined` for any other work. */
function fixWorkNow(work: { kind: string; number?: IssueNumber } | null, fixes: Record<FixKind, Folders>): Now | undefined {
  if (!work?.number || !isFixKind(work.kind)) return undefined;
  return fixNow(work.kind, work.number, fixes[work.kind]) ?? NOTHING;
}

/**
 * The PRD the status line's facts name for the session, or `null`. Given `branch`, the facts read the
 * session as on that branch and with no record: the one question they ask of the session's branch is
 * answered with it, so that a PRD named by number is read by PRD 324's rules exactly as on its
 * feature branch.
 */
function prdFactsOf({ folder, sessionId, exec, now }: Reading, branch: string | null): PrdFacts | null {
  const asked: ExecText = (file, args, options) => (branch !== null && file === 'git' && args.join(' ') === 'rev-parse --abbrev-ref HEAD' ? `${branch}\n` : exec(file, args, options));
  return readFacts({ currentDir: folder, projectDir: null, sessionId: branch === null ? sessionId : null }, { cwd: folder, exec: asked, now, spawn: null }).prd;
}

function prdNow(reading: Reading, branch: string | null = null): Now | null {
  const prd = prdFactsOf(reading, branch);
  return prd ? nowOfPrd({ number: prd.number, topic: prd.topic, stage: prd.stage, slices: prd.slices?.map(named) ?? null }) : null;
}

/** PRD `number`, read as a session on its feature branch reads it; the session on nothing when it has no folder. */
function prdNumbered(ctx: Context, number: PrdNumber, reading: Reading): Now {
  const { inbox, shipped } = ctx.layout.dirs;
  const folders = [inbox, shipped].flatMap((dir) => {
    const { checkout, base } = foldersAt(ctx, dir, reading.base, reading.exec);
    return [...checkout, ...base];
  });
  const topic = folders.map(parseFolderName).find((parsed) => parsed?.prd === number)?.topic;
  return topic ? (prdNow(reading, fillBranch(ctx.config.branches.feature, { topic })) ?? NOTHING) : NOTHING;
}

/** The session's work in the checkout of `ctx`, read branch first, then record. */
function readWork(ctx: Context, reading: Reading, recorded: RecordedWork | null): Now {
  const { folder, exec, base } = reading;
  const fixes: Record<FixKind, Folders> = { bug: foldersAt(ctx, bugRoot(ctx), base, exec), visual: foldersAt(ctx, visualRoot(ctx), base, exec) };
  const all = (kind: FixKind): string[] => [...fixes[kind].checkout, ...fixes[kind].base];
  const head = attempt(() => exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: folder, ...QUIET }).trim(), null);
  const onBranch = findWork({ claudeSessionId: null, drafts: null, branch: head, branches: ctx.config.branches, folders: { visual: all('visual'), bugs: all('bug') } });
  return fixWorkNow(onBranch, fixes) ?? prdNow(reading) ?? fixWorkNow(recorded, fixes) ?? NOTHING;
}

/** What the session is on in the checkout of `ctx`: the headline, then the work under it. */
function readSession(ctx: Context, reading: Reading): Now {
  const recorded = recordedWork({ cwd: reading.folder, exec: reading.exec, sessionId: reading.sessionId });
  const loop = runningLoop(ctx, reading);
  if (loop?.last) return underHeadline(prdNumbered(ctx, loop.last.prd, reading), loop.headline, loop.last);
  if (loop) return underHeadline(readWork(ctx, reading, recorded), loop.headline, null);
  const roadmap = recorded?.kind === 'roadmap' ? roadmapNamed(ctx, recorded.number, reading.base, reading.exec) : null;
  return roadmap ? underHeadline(NOTHING, roadmap, null) : readWork(ctx, reading, recorded);
}

/** What `omni sync` last kept in the main checkout `main`, as the answer carries it; `null` for none. */
function syncOf(main: string | null): NowSync | null {
  const record = main ? readSyncCache(main) : null;
  if (!record) return null;
  const { status, headline, checkedAt } = record;
  return { status, headline, checkedAt, ...(status === 'blue' ? { setupDone: record.setup?.done ?? 0 } : {}) };
}


/** What a read of the session keeps for its status: the answer, the checkout, its main checkout and how it was read. */
export type NowSession = { answer: Now; ctx: Context; main: string | null; reading: Reading };

/**
 * What the session in `folder` (else the process's own `cwd`), whose id is `sessionId`, is on now,
 * as of `now` (milliseconds): git is run through `exec`, as of the last fetch. `null` outside an
 * installed repository. Never throws.
 */
export function readNowSession({ cwd, folder, sessionId, exec, now }: { cwd: string; folder: string | null; sessionId: string | null; exec: ExecText; now: number }): NowSession | null {
  try {
    const where = folder ?? cwd;
    const ctx = contextOf(where, exec);
    if (!ctx) return null;
    const reading: Reading = { folder: where, sessionId, exec, now, base: baseOf(ctx, exec) };
    const answer = readSession(ctx, reading);
    const main = attempt(() => mainCheckout(where, exec), null);
    const withLinks = linked(answer, (kind, n) => (main ? readLinks(main, kind, n, now) : []));
    const waited = withWait(withLinks, readWait(ctx.root, answer.work?.kind === 'prd' ? answer.work.number : null, now));
    return { answer: withSync(waited, syncOf(main)), ctx, main, reading };
  } catch {
    return null;
  }
}

/** What the session in `folder` (else `cwd`), whose id is `sessionId`, is on now: the session on nothing when it cannot be read. */
export function readNow(args: { cwd: string; folder: string | null; sessionId: string | null; exec: ExecText; now: number }): Now {
  return readNowSession(args)?.answer ?? NOTHING;
}

/** The pull request a status reads: kept (or just fetched), with its link, and when it was read. */
export type KeptStatusPullRequest = { at: string; url: string; state: StatusPr['state']; files: readonly string[]; checks: NonNullable<StatusPr['checks']> };

/** Whether the fix branch of `topic` exists here, locally or on the remote. */
function fixBranchExists(ctx: Context, topic: string, exec: ExecText): boolean {
  const branch = fillBranch(ctx.config.branches.fix, { topic });
  const { remote } = ctx.config.repo;
  return [`refs/heads/${branch}`, `refs/remotes/${remote}/${branch}`].some((ref) => attempt(() => exec('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: ctx.root, ...QUIET }) !== '', false));
}

/** The folder of the work numbered `n` among `dirs`, in the checkout or on the base. */
function folderOf(ctx: Context, dirs: readonly string[], n: number, { base, exec }: Reading): { dir: string; name: string } | null {
  for (const dir of dirs) {
    const { checkout, base: onBase } = foldersAt(ctx, dir, base, exec);
    const name = [...checkout, ...onBase].find((entry) => parseFolderName(entry)?.prd === n);
    if (name) return { dir, name };
  }
  return null;
}

/** The facts every kind of work has: its title, its pull request and its links, from the links kept beside it. */
function commonFacts({ ctx }: NowSession, work: NowWork, pullRequest: KeptStatusPullRequest | null, checked: StatusChecked) {
  const prd = work.kind === 'prd';
  const linkOf = (prefix: string): string | null => work.links.find((link) => link.label.startsWith(prefix))?.href ?? null;
  const slug = ctx.config.repo.slug;
  return {
    title: work.topic,
    pullRequest: pullRequest ? { state: pullRequest.state, files: pullRequest.files, checks: pullRequest.checks } : null,
    links: {
      page: linkOf(prd ? 'PRD page' : 'fix page'),
      issueUrl: slug ? `https://github.com/${slug}/issues/${String(work.number)}` : null,
      pullRequest: pullRequest?.url ?? linkOf(prd ? 'feature PR' : 'fix PR'),
    },
    checked,
  };
}

/** The facts of the fix the session is on. */
function fixStatusFacts(session: NowSession, work: Extract<NowWork, { kind: 'bug' | 'visual' }>, common: ReturnType<typeof commonFacts>): FixStatusFacts {
  const { ctx, reading } = session;
  const found = folderOf(ctx, [work.kind === 'bug' ? bugRoot(ctx) : visualRoot(ctx)], work.number, reading);
  return { ...common, kind: work.kind, number: work.number, folder: found ? `${found.dir}/${found.name}` : '', branch: fixBranchExists(ctx, work.topic, reading.exec), merged: work.stage === 'merged' };
}

/** Whether the plan of the PRD whose folder is `found` is written. */
const planWritten = (ctx: Context, found: { dir: string; name: string } | null): boolean => found !== null && existsSync(join(ctx.root, found.dir, found.name, 'plan.md'));

/** The facts a PRD's stage and its board's cache give: where its folder is, whether it is approved, its slices and open questions. */
function prdBoardFacts(prd: PrdFacts | null, stage: WorkStage | null) {
  return {
    folder: stage === 'shipped' ? ('shipped' as const) : ('inbox' as const),
    approved: stage !== null && stage !== 'in review',
    slices: prd?.slices?.map(({ id, state }) => ({ id, state })) ?? null,
    openQuestions: prd?.openItems ?? 0,
  };
}

/** The facts of the PRD the session is on. */
function prdStatusFacts(session: NowSession, work: Extract<NowWork, { kind: 'prd' }>, common: ReturnType<typeof commonFacts>): PrdStatusFacts {
  const { answer, ctx, reading } = session;
  const prd = prdFactsOf(reading, fillBranch(ctx.config.branches.feature, { topic: work.topic }));
  return {
    ...common,
    ...prdBoardFacts(prd, prd?.stage ?? work.stage),
    kind: 'prd',
    number: work.number,
    approvalWait: answer.wait?.prd === work.number && !answer.wait.toast,
    phase0Open: work.links.some((link) => link.label.startsWith('phase-0 PR')),
    plan: planWritten(ctx, folderOf(ctx, [ctx.layout.dirs.inbox], work.number, reading)),
  };
}

/**
 * The facts of the work the session is on, as the status reads them (PRD 2906): from this computer
 * alone, the pull request being the copy kept beside the links or the one just fetched. `null` when
 * the session is on no work.
 */
export function statusFacts(session: NowSession, pullRequest: KeptStatusPullRequest | null, checked: StatusChecked): StatusFacts | null {
  const { work } = session.answer;
  if (!work) return null;
  const common = commonFacts(session, work, pullRequest, checked);
  return work.kind === 'prd' ? prdStatusFacts(session, work, common) : fixStatusFacts(session, work, common);
}

/** The pull request kept beside the links of the work the session is on, as the status reads it; `null` when none is kept. */
export function keptPullRequest({ answer, main }: NowSession): KeptStatusPullRequest | null {
  const { work } = answer;
  const kept = work && main ? readPullRequest(main, work.kind, work.number) : null;
  return kept ? { at: kept.at, url: kept.url, state: kept.state, files: kept.files, checks: kept.checks } : null;
}
