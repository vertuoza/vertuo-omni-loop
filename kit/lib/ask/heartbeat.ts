// The heartbeat (PRD 757's spec, "The heartbeat"): a terminal tells the Omni page that its Claude
// session is working, and on what. `omni heartbeat` runs after every tool call and sends
// `POST /api/ask/heartbeat {claudeSessionId, repo, work}` at most once per `HEARTBEAT_EVERY_MS` per
// Claude session; the session's end sends `ended: true` once. Nothing here ever fails a tool.
//
// - **The work finder** (`findWork`, pure): the draft this Claude session opened with
//   `omni dossier open` (`{kind: 'draft', draftId}`, or the PRD it was numbered as); else the PRD of a
//   feature, phase-0 or slice branch whose `<nnnn>-<topic>` folder sits in the inbox or in shipped;
//   else the visual or the bug fix of a fix branch; else `null`, the session alone.
// - **The window** (`claimWindow`): the time of the session's last call, kept in
//   `.omni-loop/local/heartbeat/<Claude session id>.json` of the main checkout, so every worktree of
//   one session shares it. It is claimed before the call goes out: a call inside the window does no
//   network work at all.
//
// Only the Claude session id, the repository's name, the work's kind and number (or the draft's id)
// leave the machine, and the server stamps the time. No tool name, path, command or transcript text.
import { execFileSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mainCheckout, readDossiers } from '../dossier/local.ts';
import type { ExecText } from '../context.ts';
import type { DossierEntry } from '../dossier/draft.ts';
import { isSafeId, LOCAL_DIR } from './local-state.ts';
import { HeartbeatWindowSchema } from './schema.ts';
import type { IssueNumber, PrdNumber } from '../ids.ts';
import { parseFolderName } from '../layout.ts';

/** What a Claude session works on: its draft, a PRD, a visual or a bug fix (keyed by its issue); `null`
 * is the session alone. */
export type Work = { kind: 'draft'; draftId: string } | { kind: 'prd'; number: PrdNumber } | { kind: 'visual' | 'bug'; number: IssueNumber } | null;

/** The branch templates the work finder reads. */
type Branches = { feature: string; phase0: string; slice: string; fix: string };

/** The delivery folders the work finder looks among, by where they sit. */
type Folders = { inbox?: readonly string[]; shipped?: readonly string[]; visual?: readonly string[]; bugs?: readonly string[] };

/** The least time between two calls of one Claude session. */
export const HEARTBEAT_EVERY_MS = 60_000;
/** The most one heartbeat may take, sign-in renewal included. */
export const HEARTBEAT_LIMIT_MS = 2000;

const WINDOWS_DIR = 'heartbeat';
const QUIET: { encoding: 'utf8'; stdio: StdioOptions; timeout: number } = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: HEARTBEAT_LIMIT_MS };

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** A branch template (`feat/{topic}--{slice}`) as an anchored pattern whose first group is the topic. */
function topicOf(template: unknown, branch: string): string | null {
  if (typeof template !== 'string' || !template.includes('{topic}')) return null;
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped.replace(/\{topic\}/, '(.+?)').replace(/\{slice\}/, '[^/]+')}$`);
  return pattern.exec(branch)?.[1] ?? null;
}

/** The number of the `<nnnn>-<topic>` folder among `folders`, or null. A fix's folder is named the
 * way a PRD's is, by its issue's number, which a PRD's number is too. */
function numberOf(topic: string, folders: readonly string[] | undefined): PrdNumber | null {
  for (const folder of folders ?? []) {
    const named = parseFolderName(folder);
    if (named && named.topic === topic) return named.prd;
  }
  return null;
}

/**
 * What a Claude session works on. Pure.
 */
export function findWork({ claudeSessionId, drafts, branch, branches, folders }: {
  claudeSessionId: string | null;
  drafts: readonly DossierEntry[] | null | undefined;
  branch: string | null;
  branches: Branches;
  folders: Folders;
}): Work {
  const own = claudeSessionId ? draftWork(claudeSessionId, drafts) : null;
  if (own) return own;
  if (typeof branch !== 'string' || !branch) return null;
  return prdWork(branch, branches, folders) ?? fixWork(branch, branches, folders);
}

/** The session's latest draft, as its work (its PRD once it has one), or `null`. */
function draftWork(claudeSessionId: string, drafts: readonly DossierEntry[] | null | undefined): Work {
  const own = (drafts ?? [])
    .filter((entry) => entry.claudeSessionId === claudeSessionId)
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
    .at(-1);
  if (!own) return null;
  return own.prd === null ? { kind: 'draft', draftId: own.id } : { kind: 'prd', number: own.prd };
}

/** The PRD a slice, phase-0 or feature branch builds, or `null`. */
function prdWork(branch: string, branches: Branches, folders: Folders): Work {
  const prdFolders = [...(folders.inbox ?? []), ...(folders.shipped ?? [])];
  // A slice branch is tried before a feature branch: `feat/{topic}` would take `x--s1` as its topic.
  for (const template of [branches.slice, branches.phase0, branches.feature]) {
    const topic = topicOf(template, branch);
    const number = topic && numberOf(topic, prdFolders);
    if (number) return { kind: 'prd', number };
  }
  return null;
}

/** The visual or bug fix a fix branch makes, or `null`. */
function fixWork(branch: string, branches: Branches, folders: Folders): Work {
  const fix = topicOf(branches.fix, branch);
  if (!fix) return null;
  const visual = numberOf(fix, folders.visual);
  if (visual) return { kind: 'visual', number: visual };
  const bug = numberOf(fix, folders.bugs);
  return bug ? { kind: 'bug', number: bug } : null;
}

/**
 * What the Claude session `claudeSessionId` works on, read from this computer: the drafts the main
 * checkout records, the branch checked out in `cwd`, and the delivery folders of the checkout `cwd`
 * is in. Never throws: anything it cannot read counts as absent.
 */
export function readWork({ cwd, config, claudeSessionId, exec = execFileSync }: {
  cwd: string;
  config: { paths: { delivery: string }; branches: Branches };
  claudeSessionId: string | null;
  exec?: ExecText;
}): Work {
  const home = attempt(() => mainCheckout(cwd, exec));
  const drafts = home ? attempt(() => readDossiers(home)) ?? [] : [];
  const head = attempt(() => exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, ...QUIET }).trim());
  const branch = head && head !== 'HEAD' ? head : null;
  const top = attempt(() => exec('git', ['rev-parse', '--show-toplevel'], { cwd, ...QUIET }).trim());
  const list = (folder: string): string[] => (top ? attempt(() => readdirSync(join(top, config.paths.delivery, folder))) ?? [] : []);
  const folders = { inbox: list('inbox'), shipped: list('shipped'), visual: list('visual'), bugs: list('bugs') };
  return attempt(() => findWork({ claudeSessionId, drafts, branch, branches: config.branches, folders })) ?? null;
}

const windowFile = (root: string, claudeSessionId: string): string => join(root, LOCAL_DIR, WINDOWS_DIR, `${claudeSessionId}.json`);

/**
 * Whether the session may call now: true, and `now` kept as its last call, when its last call is at
 * least `HEARTBEAT_EVERY_MS` old or it has none; false otherwise, and for an id that cannot name a file.
 */
export function claimWindow(root: string, claudeSessionId: unknown, now: number): boolean {
  if (!isSafeId(claudeSessionId)) return false;
  const file = windowFile(root, claudeSessionId);
  const window = HeartbeatWindowSchema.safeParse(attempt((): unknown => JSON.parse(readFileSync(file, 'utf8'))));
  const last = window.success ? window.data.sentAt : null;
  if (last !== null && Number.isFinite(last) && now - last < HEARTBEAT_EVERY_MS && now >= last) return false;
  const dir = join(root, LOCAL_DIR);
  mkdirSync(join(dir, WINDOWS_DIR), { recursive: true });
  if (!existsSync(join(dir, '.gitignore'))) writeFileSync(join(dir, '.gitignore'), '*\n');
  writeFileSync(file, `${JSON.stringify({ sentAt: now })}\n`);
  return true;
}

/** Deletes the session's window, once it has ended. */
export function forgetWindow(root: string, claudeSessionId: unknown): void {
  if (isSafeId(claudeSessionId)) rmSync(windowFile(root, claudeSessionId), { force: true });
}
