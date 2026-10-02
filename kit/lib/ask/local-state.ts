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
import { jsonObject, ModeFileSchema, RoundFileSchema, TerminalFileSchema } from './schema.ts';
import type { JsonObject, RoundStatus } from './schema.ts';

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
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** A terminal's ask session. */
export type TerminalSession = { sessionId: string; host: string };

/** A question's round, as this checkout keeps it. */
export type Round = { roundId: string; status: RoundStatus };

/** Whether `id` may name a file: letters, digits, `_` and `-`, 1 to 128 of them. */
export const isSafeId = (id: unknown): id is string => typeof id === 'string' && SAFE_ID.test(id);

/** Whether `name` may name a screenshot's file: a plain name and an extension, nothing more. */
export const isShotName = (name: unknown): name is string => typeof name === 'string' && SHOT_NAME.test(name);

function localFile(root: string, file: string): string {
  return join(root, LOCAL_DIR, file);
}

/** The folder, with its `.gitignore` written once and never rewritten. */
export function ensureLocalDir(root: string): void {
  const dir = join(root, LOCAL_DIR);
  mkdirSync(dir, { recursive: true });
  const ignore = join(dir, '.gitignore');
  if (!existsSync(ignore)) writeFileSync(ignore, '*\n');
}

function readJson(root: string, file: string): JsonObject | null {
  try {
    return jsonObject(JSON.parse(readFileSync(localFile(root, file), 'utf8')));
  } catch {
    return null;
  }
}

function writeJson(root: string, file: string, value: unknown): void {
  ensureLocalDir(root);
  mkdirSync(dirname(localFile(root, file)), { recursive: true });
  writeFileSync(localFile(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

function safe(id: unknown): string {
  if (!isSafeId(id)) throw new Error(`not a safe file name: ${JSON.stringify(id)}`);
  return id;
}

const terminalFile = (terminalId: string): string => join(TERMINALS_DIR, `${safe(terminalId)}.json`);
const roundFile = (toolUseId: string): string => join(ROUNDS_DIR, `${safe(toolUseId)}.json`);

/** The mode in this checkout, or `null` when it is off; `sessionId` is a PRD 71 session's. */
export function readMode(root: string): { host: string; sessionId: string | null } | null {
  const mode = ModeFileSchema.safeParse(readJson(root, MODE_FILE));
  return mode.success ? mode.data : null;
}

export function writeMode(root: string, { host }: { host: string }): void {
  writeJson(root, MODE_FILE, { host });
}

/** Deletes `ask.json`, every terminal's session and round, and PRD 71's round file. The screenshots
 * downloaded stay: they go only when they are 7 days old. */
export function clearMode(root: string): void {
  rmSync(localFile(root, MODE_FILE), { force: true });
  const dir = localFile(root, TERMINALS_DIR);
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    // No terminal ever asked here.
  }
  for (const name of names) if (name !== SHOTS) rmSync(join(dir, name), { recursive: true, force: true });
  if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
  rmSync(localFile(root, LEGACY_ROUND_FILE), { force: true });
}

export function readTerminal(root: string, terminalId: unknown): TerminalSession | null {
  if (!isSafeId(terminalId)) return null;
  const session = TerminalFileSchema.safeParse(readJson(root, terminalFile(terminalId)));
  return session.success ? session.data : null;
}

export function writeTerminal(root: string, terminalId: string, { sessionId, host }: TerminalSession): void {
  writeJson(root, terminalFile(terminalId), { sessionId, host });
}

export function clearTerminal(root: string, terminalId: unknown): void {
  if (isSafeId(terminalId)) rmSync(localFile(root, terminalFile(terminalId)), { force: true });
}

/** Every terminal's session in this checkout, by terminal id. */
export function listTerminals(root: string): ({ terminalId: string } & TerminalSession)[] {
  let names: string[];
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

export function readRound(root: string, toolUseId: unknown): Round | null {
  if (!isSafeId(toolUseId)) return null;
  const round = RoundFileSchema.safeParse(readJson(root, roundFile(toolUseId)));
  return round.success ? round.data : null;
}

export function writeRound(root: string, toolUseId: string, { roundId, status }: Round): void {
  writeJson(root, roundFile(toolUseId), { roundId, status });
}

export function clearRound(root: string, toolUseId: unknown): void {
  if (isSafeId(toolUseId)) rmSync(localFile(root, roundFile(toolUseId)), { force: true });
}

/**
 * Writes one of a round's screenshots into `ask/shots/<round id>/<name>`, and returns its absolute
 * path. Throws for a round id or a name that could leave that folder.
 */
export function writeShot(root: string, roundId: string, name: string, bytes: Uint8Array | string): string {
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
export function clearOldShots(root: string, now: number, maxAgeMs: number = SHOTS_MAX_AGE_MS): string[] {
  const dir = localFile(root, SHOTS_DIR);
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return [];
  }
  const removed: string[] = [];
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
