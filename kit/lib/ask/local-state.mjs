// Ask mode's state in one checkout: `.omni-loop/local/`, beside the config and inside the kit's
// footprint. The folder carries its own `.gitignore` (`*`), so nothing in it is ever committed and
// the repository's own `.gitignore` is never touched.
//
// - `ask.json` — the open session: `{ sessionId, url, host }`. `url` is the session's page (the link
//   a person opens), `host` the host of `ask.url` it was opened on. Its presence is the mode being on.
// - `ask-round.json` — the round the `pre` hook posted, for the `post` hook: `{ roundId, toolUseId,
//   status }`, `status` being `open`, `answered` (on the page) or `abandoned`.
//
// A file that is missing, half-written or not the right shape reads as `null`: the hooks then stay
// quiet, which is always the safe answer.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_FILE } from '../config.mjs';

export const LOCAL_DIR = join(dirname(CONFIG_FILE), 'local');
const SESSION_FILE = 'ask.json';
const ROUND_FILE = 'ask-round.json';
const ROUND_STATUSES = ['open', 'answered', 'abandoned'];

const isText = (value) => typeof value === 'string' && value.length > 0;

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
  writeFileSync(localFile(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

/** @returns {{ sessionId: string, url: string, host: string } | null} */
export function readSession(root) {
  const value = readJson(root, SESSION_FILE);
  if (!value || !isText(value.sessionId) || !isText(value.url) || !isText(value.host)) return null;
  return { sessionId: value.sessionId, url: value.url, host: value.host };
}

/** @param {{ sessionId: string, url: string, host: string }} session */
export function writeSession(root, { sessionId, url, host }) {
  writeJson(root, SESSION_FILE, { sessionId, url, host });
}

export function clearSession(root) {
  rmSync(localFile(root, SESSION_FILE), { force: true });
}

/** @returns {{ roundId: string, toolUseId: string | null, status: 'open' | 'answered' | 'abandoned' } | null} */
export function readRound(root) {
  const value = readJson(root, ROUND_FILE);
  if (!value || !isText(value.roundId)) return null;
  return {
    roundId: value.roundId,
    toolUseId: isText(value.toolUseId) ? value.toolUseId : null,
    status: ROUND_STATUSES.includes(value.status) ? value.status : 'open',
  };
}

/** @param {{ roundId: string, toolUseId?: string | null, status: 'open' | 'answered' | 'abandoned' }} round */
export function writeRound(root, { roundId, toolUseId = null, status }) {
  writeJson(root, ROUND_FILE, { roundId, toolUseId, status });
}

export function clearRound(root) {
  rmSync(localFile(root, ROUND_FILE), { force: true });
}
