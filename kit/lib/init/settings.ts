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
import { CommandStatusLineSchema, JsonObjectSchema } from './schema.ts';

/** What became of the `statusLine` key. */
export type StatusLineOutcome = 'wrote' | 'kept' | 'foreign' | 'invalid';

/** The kit's `statusLine` value. */
export type StatusLineSetting = { type: 'command'; command: string; refreshInterval: number };

export const SETTINGS_FILE = posix.join('.claude', 'settings.json');
// Where a person keeps a line of their own: Claude Code reads it before the committed file.
export const PERSONAL_SETTINGS_FILE = posix.join('.claude', 'settings.local.json');
export const STATUS_LINE_KEY = 'statusLine';

// Claude Code sends no event while a session waits on background subagents: run the line anyway.
const REFRESH_SECONDS = 30;

/** The bin's path as the command names it, from the repository's top level: forward slashes. */
const commandPath = (bin: string): string => bin.split(sep).join(posix.sep);

/**
 * The kit's `statusLine` value for the bin at `bin` (a path from the repository root). The bin is
 * found from `CLAUDE_PROJECT_DIR` when Claude Code sets it, else from the checkout's top level, so
 * the line runs from any folder of any worktree.
 */
export function statusLineSetting(bin: string): StatusLineSetting {
  return {
    type: 'command',
    command: `node "\${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/${commandPath(bin)}" statusline`,
    refreshInterval: REFRESH_SECONDS,
  };
}

/** Whether a `statusLine` value is the kit's own: its command runs the bin's `statusline`. */
export function isKitStatusLine(value: unknown, bin: string): boolean {
  const parsed = CommandStatusLineSchema.safeParse(value);
  return parsed.success && parsed.data.command.includes(`${commandPath(bin)}" statusline`);
}

/** The settings file's text, `null` when there is none, or `undefined` when something else is in the way. */
function readSettings(file: string): string | null | undefined {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT' ? null : undefined;
  }
}

/** The settings object `text` holds, or `null` when it holds no JSON object. */
function parseSettings(text: string): Record<string, unknown> | null {
  try {
    const parsed = JsonObjectSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The settings object in `file`, `{}` when there is no file, or `null` when it holds no JSON object. */
function loadSettings(file: string): Record<string, unknown> | null {
  const text = readSettings(file);
  return text === null ? {} : parseSettings(text ?? '');
}

/**
 * Merges the kit's `statusLine` key into `<root>/.claude/settings.json`. `bin` is the installed
 * bin's path from the root (`omni init`'s `BIN_FILE`); `force` rewrites the kit's own line when one
 * is already there. Returns what became of the key: written, the kit's own kept, someone else's
 * kept, or the file left alone for holding no JSON object.
 */
export function writeStatusLine(root: string, { bin, force = false }: { bin: string; force?: boolean }): { path: string; outcome: StatusLineOutcome } {
  const file = join(root, SETTINGS_FILE);
  const settings = loadSettings(file);
  if (!settings) return { path: SETTINGS_FILE, outcome: 'invalid' };
  if (Object.hasOwn(settings, STATUS_LINE_KEY)) {
    if (!isKitStatusLine(settings[STATUS_LINE_KEY], bin)) return { path: SETTINGS_FILE, outcome: 'foreign' };
    if (!force) return { path: SETTINGS_FILE, outcome: 'kept' };
  }
  // Assigning an existing key keeps its place; a new one goes last.
  settings[STATUS_LINE_KEY] = statusLineSetting(bin);
  writeSettings(file, settings);
  return { path: SETTINGS_FILE, outcome: 'wrote' };
}

/** Writes `settings` to `file` as two-space JSON with a final newline, creating its folder. */
function writeSettings(file: string, settings: Record<string, unknown>): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
}

// The band above the prompt (PRD 1208): the `omni-hud` plugin of the kit's marketplace, turned on in
// the same file by the same rules, one line of `enabledPlugins`.
export const ENABLED_PLUGINS_KEY = 'enabledPlugins';
export const HUD_PLUGIN = 'omni-hud@omni-loop';

/** What became of the band's line: written, already on, someone else's value (or no plugins object), or no JSON object. */
export type HudOutcome = 'wrote' | 'kept' | 'theirs' | 'invalid';

/**
 * Turns the band on: adds `"omni-hud@omni-loop": true` to `enabledPlugins` in
 * `<root>/.claude/settings.json`, creating the file, or the key, when missing. Every other key and
 * plugin is kept in its order. A value already set for the band is never touched (`true` is kept,
 * anything else is someone else's choice), nor an `enabledPlugins` that is not an object; a file
 * that holds no JSON object is left byte-identical.
 */
export function enableHud(root: string): { path: string; outcome: HudOutcome } {
  const file = join(root, SETTINGS_FILE);
  const settings = loadSettings(file);
  if (!settings) return { path: SETTINGS_FILE, outcome: 'invalid' };
  const present = Object.hasOwn(settings, ENABLED_PLUGINS_KEY);
  const plugins = present ? JsonObjectSchema.safeParse(settings[ENABLED_PLUGINS_KEY]) : { success: true as const, data: {} };
  if (!plugins.success) return { path: SETTINGS_FILE, outcome: 'theirs' };
  if (Object.hasOwn(plugins.data, HUD_PLUGIN)) return { path: SETTINGS_FILE, outcome: plugins.data[HUD_PLUGIN] === true ? 'kept' : 'theirs' };
  settings[ENABLED_PLUGINS_KEY] = { ...plugins.data, [HUD_PLUGIN]: true };
  writeSettings(file, settings);
  return { path: SETTINGS_FILE, outcome: 'wrote' };
}

// The outcomes that leave a line of the kit's own in the settings file.
const OWN_LINE: ReadonlySet<string> = new Set(['wrote', 'kept']);

/**
 * The settings file, once, when init's install pull request should commit it: while the kit's
 * status line or the band's line is in it. Someone else's lines, or a file that is not JSON, are
 * none of the loop's to commit.
 */
export function ownSettingsPaths(results: readonly { path: string; outcome: string }[]): string[] {
  const own = results.find((result) => OWN_LINE.has(result.outcome));
  return own ? [own.path] : [];
}
