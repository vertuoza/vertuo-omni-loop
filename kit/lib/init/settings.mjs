// The status line `omni init` switches on (PRD 324): the one key it writes outside its own folder,
// `statusLine` in the repository's committed `.claude/settings.json`, which runs the installed bin's
// `statusline` command for everyone who opens Claude Code in the repository.
//
// The file is created, with its folder, when it does not exist; every other key is kept, in its
// order, and the file is written as two-space JSON with a final newline. The kit's own line (its
// command runs the bin's `statusline`) is kept, and rewritten only with `force`. Anyone else's line
// is never touched, even with `force`. A file that holds no JSON object of settings (not JSON, or
// JSON of another shape) is left byte-identical.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, sep } from 'node:path';

export const SETTINGS_FILE = posix.join('.claude', 'settings.json');
export const STATUS_LINE_KEY = 'statusLine';

// Claude Code sends no event while a session waits on background subagents: run the line anyway.
const REFRESH_SECONDS = 30;

/** The bin's path as the command names it, from the repository's top level: forward slashes. */
const commandPath = (bin) => bin.split(sep).join(posix.sep);

/**
 * The kit's `statusLine` value for the bin at `bin` (a path from the repository root). The bin is
 * found from `CLAUDE_PROJECT_DIR` when Claude Code sets it, else from the checkout's top level, so
 * the line runs from any folder of any worktree.
 */
export function statusLineSetting(bin) {
  return {
    type: 'command',
    command: `node "\${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/${commandPath(bin)}" statusline`,
    refreshInterval: REFRESH_SECONDS,
  };
}

/** Whether a `statusLine` value is the kit's own: its command runs the bin's `statusline`. */
export function isKitStatusLine(value, bin) {
  return typeof value?.command === 'string' && value.command.includes(`${commandPath(bin)}" statusline`);
}

/** The settings file's text, `null` when there is none, or `undefined` when something else is in the way. */
function readSettings(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    return error?.code === 'ENOENT' ? null : undefined;
  }
}

/** The settings object `text` holds, or `null` when it holds no JSON object. */
function parseSettings(text) {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Merges the kit's `statusLine` key into `<root>/.claude/settings.json`.
 * @param {string} root   the repository root
 * @param {object} o
 * @param {string} o.bin  the installed bin's path from the root (`omni init`'s `BIN_FILE`)
 * @param {boolean} [o.force]  rewrite the kit's own line when one is already there
 * @returns {{ path: string, outcome: 'wrote' | 'kept' | 'foreign' | 'invalid' }}  what became of the
 *   key: written, the kit's own kept, someone else's kept, or the file left alone for holding no
 *   JSON object
 */
export function writeStatusLine(root, { bin, force = false }) {
  const file = join(root, SETTINGS_FILE);
  const text = readSettings(file);
  const settings = text === null ? {} : parseSettings(text ?? '');
  if (!settings) return { path: SETTINGS_FILE, outcome: 'invalid' };
  if (Object.hasOwn(settings, STATUS_LINE_KEY)) {
    if (!isKitStatusLine(settings[STATUS_LINE_KEY], bin)) return { path: SETTINGS_FILE, outcome: 'foreign' };
    if (!force) return { path: SETTINGS_FILE, outcome: 'kept' };
  }
  // Assigning an existing key keeps its place; a new one goes last.
  settings[STATUS_LINE_KEY] = statusLineSetting(bin);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  return { path: SETTINGS_FILE, outcome: 'wrote' };
}
