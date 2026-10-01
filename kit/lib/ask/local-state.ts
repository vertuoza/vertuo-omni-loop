// @ts-nocheck
// Ask mode's state in one checkout: `.omni-loop/local/`, beside the config and inside the kit's
// footprint. The folder carries its own `.gitignore` (`*`), so nothing in it is ever committed and
// the repository's own `.gitignore` is never touched. The mode is per checkout; the session is per
// terminal (PRD 142's spec, "The kit side").
//
// - `ask.json` — `{ host }`: the mode is on in this checkout, against the host of `ask.url`. One in
//   PRD 71's shape (`{ sessionId, url, host }`) reads as on as well; its `sessionId` is kept only so
//   that `off` can close it.
// - `ask/<terminal id>.json` — `{ sessionId, host }`: one terminal's ask session, the terminal id
//   being Claude Code's `session_id`.
// - `ask/rounds/<tool use id>.json` — `{ roundId, status }`: one question's round, `status` being
//   `open`, `answered` (on the page) or `abandoned`.
// - `ask/shots/<round id>/<name>` — the screenshots an answer given on the page carried (PRD 620),
//   downloaded for Claude to Read. A folder older than 7 days goes before a new round opens
//   (`clearOldShots`); clearing the mode keeps them.
//
// An id becomes a file name only when it is a safe one (`isSafeId`); any other reads as missing. A
// file that is missing, half-written or not the right shape reads as `null`: the hooks then stay
// quiet, which is always the safe answer.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CONFIG_FILE } from '../config.ts';

export const LOCAL_DIR = join(dirname(CONFIG_FILE), 'local');
const MODE_FILE = 'ask.json';
const TERMINALS_DIR = 'ask';
const ROUNDS_DIR = join(TERMINALS_DIR, 'rounds');
const SHOTS = 'shots';
const SHOTS_DIR = join(TERMINALS_DIR, SHOTS);
/** How long a round's downloaded screenshots are kept. */
export const SHOTS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A screenshot's file name: a plain name and an extension, nothing that could leave its folder. */
const SHOT_NAME = /^[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9]{1,8}$/;
/** PRD 71's one round file: no longer read, only deleted by `clearMode`. */
const LEGACY_ROUND_FILE = 'ask-round.json';
const ROUND_STATUSES = ['open', 'answered', 'abandoned'];
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const isText = (value) => typeof value === 'string' && value.length > 0;

/** Whether `id` may name a file: letters, digits, `_` and `-`, 1 to 128 of them. */
export const isSafeId = (id) => typeof id === 'string' && SAFE_ID.test(id);

/** Whether `name` may name a screenshot's file: a plain name and an extension, nothing more. */
export const isShotName = (name) => typeof name === 'string' && SHOT_NAME.test(name);

function localFile(root, file) {
  return join(root, LOCAL_DIR, file);
}

/** The folder, with its `.gitignore` written once and never rewritten. */
function ensureLocalDir(root) {
  const dir = join(root, LOCAL_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
}

function readJson(root, file) {
  try {
    const value = JSON.parse(readFileSync(localFile(root, file), 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function writeJson(root, file, value) {
  ensureLocalDir(root);
  mkdirSync(dirname(localFile(root, file)), { recursive: true });
  writeFileSync(localFile(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

function safe(id) {
  if (!isSafeId(id)) throw new Error(`not a safe file name: ${JSON.stringify(id)}`);
  return id;
}

const terminalFile = (terminalId) => join(TERMINALS_DIR, `${safe(terminalId)}.json`);
const roundFile = (toolUseId) => join(ROUNDS_DIR, `${safe(toolUseId)}.json`);

/** @returns {{ host: string, sessionId: string | null } | null} `sessionId` is a PRD 71 session's */
export function readMode(root) {
  const value = readJson(root, MODE_FILE);
  if (!value || !isText(value.host)) return null;
  return { host: value.host, sessionId: isText(value.sessionId) ? value.sessionId : null };
}

/** @param {{ host: string }} mode */
export function writeMode(root, { host }) {
  writeJson(root, MODE_FILE, { host });
}

/** Deletes `ask.json`, every terminal's session and round, and PRD 71's round file. The screenshots
 * downloaded stay: they go only when they are 7 days old. */
export function clearMode(root) {
  rmSync(localFile(root, MODE_FILE), { force: true });
  const dir = localFile(root, TERMINALS_DIR);
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    // No terminal ever asked here.
  }
  for (const name of names) if (name !== SHOTS) rmSync(join(dir, name), { recursive: true, force: true });
  if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
  rmSync(localFile(root, LEGACY_ROUND_FILE), { force: true });
}

/** @returns {{ sessionId: string, host: string } | null} */
export function readTerminal(root, terminalId) {
  if (!isSafeId(terminalId)) return null;
  const value = readJson(root, terminalFile(terminalId));
  if (!value || !isText(value.sessionId) || !isText(value.host)) return null;
  return { sessionId: value.sessionId, host: value.host };
}

/** @param {{ sessionId: string, host: string }} session */
export function writeTerminal(root, terminalId, { sessionId, host }) {
  writeJson(root, terminalFile(terminalId), { sessionId, host });
}

export function clearTerminal(root, terminalId) {
  if (isSafeId(terminalId)) rmSync(localFile(root, terminalFile(terminalId)), { force: true });
}

/** Every terminal's session in this checkout, by terminal id. @returns {{ terminalId: string, sessionId: string, host: string }[]} */
export function listTerminals(root) {
  let names;
  try {
    names = readdirSync(localFile(root, TERMINALS_DIR));
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter(isSafeId)
    .sort()
    .flatMap((terminalId) => {
      const session = readTerminal(root, terminalId);
      return session ? [{ terminalId, ...session }] : [];
    });
}

/** @returns {{ roundId: string, status: 'open' | 'answered' | 'abandoned' } | null} */
export function readRound(root, toolUseId) {
  if (!isSafeId(toolUseId)) return null;
  const value = readJson(root, roundFile(toolUseId));
  if (!value || !isText(value.roundId)) return null;
  return { roundId: value.roundId, status: ROUND_STATUSES.includes(value.status) ? value.status : 'open' };
}

/** @param {{ roundId: string, status: 'open' | 'answered' | 'abandoned' }} round */
export function writeRound(root, toolUseId, { roundId, status }) {
  writeJson(root, roundFile(toolUseId), { roundId, status });
}

export function clearRound(root, toolUseId) {
  if (isSafeId(toolUseId)) rmSync(localFile(root, roundFile(toolUseId)), { force: true });
}

/**
 * Writes one of a round's screenshots into `ask/shots/<round id>/<name>`, and returns its absolute
 * path. Throws for a round id or a name that could leave that folder.
 */
export function writeShot(root, roundId, name, bytes) {
  if (!isShotName(name)) throw new Error(`not a safe screenshot name: ${JSON.stringify(name)}`);
  const dir = resolve(root, LOCAL_DIR, SHOTS_DIR, safe(roundId));
  ensureLocalDir(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

/** Removes every round's screenshot folder last changed more than `maxAgeMs` before `now`; returns
 * their names. Anything else in the shots folder is left alone. */
export function clearOldShots(root, now, maxAgeMs = SHOTS_MAX_AGE_MS) {
  const dir = localFile(root, SHOTS_DIR);
  let names;
  try {
    names = readdirSync(dir).sort();
  } catch {
    return [];
  }
  const removed = [];
  for (const name of names) {
    const folder = join(dir, name);
    try {
      const stat = statSync(folder);
      if (!stat.isDirectory() || !isSafeId(name) || stat.mtimeMs >= now - maxAgeMs) continue;
      rmSync(folder, { recursive: true, force: true });
      removed.push(name);
    } catch {
      // Gone meanwhile, or unreadable: the next round tries again.
    }
  }
  return removed;
}
