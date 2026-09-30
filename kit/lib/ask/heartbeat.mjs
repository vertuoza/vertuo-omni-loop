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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mainCheckout, readDossiers } from '../dossier/local.mjs';
import { isSafeId, LOCAL_DIR } from './local-state.mjs';

/** The least time between two calls of one Claude session. */
export const HEARTBEAT_EVERY_MS = 60_000;
/** The most one heartbeat may take, sign-in renewal included. */
export const HEARTBEAT_LIMIT_MS = 2000;

const WINDOWS_DIR = 'heartbeat';
const FOLDER = /^(\d{4})-(.+)$/;
const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: HEARTBEAT_LIMIT_MS };

function attempt(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** A branch template (`feat/{topic}--{slice}`) as an anchored pattern whose first group is the topic. */
function topicOf(template, branch) {
  if (typeof template !== 'string' || !template.includes('{topic}')) return null;
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped.replace(/\{topic\}/, '(.+?)').replace(/\{slice\}/, '[^/]+')}$`);
  return pattern.exec(branch)?.[1] ?? null;
}

/** The number of the `<nnnn>-<topic>` folder among `folders`, or null. */
function numberOf(topic, folders) {
  for (const folder of folders ?? []) {
    const match = FOLDER.exec(folder);
    if (match && match[2] === topic) return Number(match[1]);
  }
  return null;
}

/**
 * What a Claude session works on. Pure.
 *
 * @param {{ claudeSessionId: string | null, drafts: import('../dossier/draft.mjs').DossierEntry[],
 *   branch: string | null, branches: { feature: string, phase0: string, slice: string, fix: string },
 *   folders: { inbox: string[], shipped: string[], visual: string[], bugs: string[] } }} where
 * @returns {{ kind: 'draft', draftId: string } | { kind: 'prd' | 'visual' | 'bug', number: number } | null}
 */
export function findWork({ claudeSessionId, drafts, branch, branches, folders }) {
  if (claudeSessionId) {
    const own = (drafts ?? [])
      .filter((entry) => entry.claudeSessionId === claudeSessionId)
      .sort((a, b) => String(a.openedAt).localeCompare(String(b.openedAt)))
      .at(-1);
    if (own) return own.prd === null ? { kind: 'draft', draftId: own.id } : { kind: 'prd', number: own.prd };
  }
  if (typeof branch !== 'string' || !branch) return null;
  const prdFolders = [...(folders.inbox ?? []), ...(folders.shipped ?? [])];
  // A slice branch is tried before a feature branch: `feat/{topic}` would take `x--s1` as its topic.
  for (const template of [branches.slice, branches.phase0, branches.feature]) {
    const topic = topicOf(template, branch);
    const number = topic && numberOf(topic, prdFolders);
    if (number) return { kind: 'prd', number };
  }
  const fix = topicOf(branches.fix, branch);
  if (fix) {
    const visual = numberOf(fix, folders.visual);
    if (visual) return { kind: 'visual', number: visual };
    const bug = numberOf(fix, folders.bugs);
    if (bug) return { kind: 'bug', number: bug };
  }
  return null;
}

/**
 * What the Claude session `claudeSessionId` works on, read from this computer: the drafts the main
 * checkout records, the branch checked out in `cwd`, and the delivery folders of the checkout `cwd`
 * is in. Never throws: anything it cannot read counts as absent.
 *
 * @param {{ cwd: string, config: any, claudeSessionId: string | null, exec?: typeof execFileSync }} options
 */
export function readWork({ cwd, config, claudeSessionId, exec = execFileSync }) {
  const home = attempt(() => mainCheckout(cwd, exec));
  const drafts = home ? attempt(() => readDossiers(home)) ?? [] : [];
  const head = attempt(() => String(exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, ...QUIET })).trim());
  const branch = head && head !== 'HEAD' ? head : null;
  const top = attempt(() => String(exec('git', ['rev-parse', '--show-toplevel'], { cwd, ...QUIET })).trim());
  const list = (folder) => (top ? attempt(() => readdirSync(join(top, config.paths.delivery, folder))) ?? [] : []);
  const folders = { inbox: list('inbox'), shipped: list('shipped'), visual: list('visual'), bugs: list('bugs') };
  return attempt(() => findWork({ claudeSessionId, drafts, branch, branches: config.branches, folders })) ?? null;
}

const windowFile = (root, claudeSessionId) => join(root, LOCAL_DIR, WINDOWS_DIR, `${claudeSessionId}.json`);

/**
 * Whether the session may call now: true, and `now` kept as its last call, when its last call is at
 * least `HEARTBEAT_EVERY_MS` old or it has none; false otherwise, and for an id that cannot name a file.
 */
export function claimWindow(root, claudeSessionId, now) {
  if (!isSafeId(claudeSessionId)) return false;
  const file = windowFile(root, claudeSessionId);
  const last = attempt(() => JSON.parse(readFileSync(file, 'utf8')).sentAt);
  if (Number.isFinite(last) && now - last < HEARTBEAT_EVERY_MS && now >= last) return false;
  const dir = join(root, LOCAL_DIR);
  mkdirSync(join(dir, WINDOWS_DIR), { recursive: true });
  if (!existsSync(join(dir, '.gitignore'))) writeFileSync(join(dir, '.gitignore'), '*\n');
  writeFileSync(file, `${JSON.stringify({ sentAt: now })}\n`);
  return true;
}

/** Deletes the session's window, once it has ended. */
export function forgetWindow(root, claudeSessionId) {
  if (isSafeId(claudeSessionId)) rmSync(windowFile(root, claudeSessionId), { force: true });
}
