// @ts-nocheck
// Reads `.omni-loop/config.yml`. Every repository-specific value the kit needs is a key of its one
// definition, `kit/lib/schema/config.ts`; a key that is not there does not exist, and a key the file
// has that is not there is an error, never ignored.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { CONFIG_VERSION, ConfigSchema, TARGET_KNOWLEDGE } from './schema/config.ts';
import { KIT_MESSAGES } from './schema/messages.ts';

export { CONFIG_VERSION, ConfigSchema, TARGET_KNOWLEDGE };

export const CONFIG_FILE = '.omni-loop/config.yml';

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Whether dossiers are on in a repository (PRD 216): `dossier.enabled` is true and `ask.url` is set.
 * `reason` says why, in the words `omni dossier status` prints; `askUrl` is where the calls go.
 *
 * @returns {{ on: true, reason: string, askUrl: string } | { on: false, reason: string }}
 */
export function dossierSwitch(config) {
  if (!config.dossier.enabled) return { on: false, reason: 'dossier.enabled is false' };
  if (!config.ask.url) return { on: false, reason: 'ask.url is not set' };
  return { on: true, reason: `dossier.enabled is true in ${CONFIG_FILE}`, askUrl: config.ask.url };
}

/** Keys a config once held under another name (PRD #68): refused, naming the key that replaced them,
 * never read as an alias — a person set them by hand, and a clear error beats a silent alias. */
const RENAMED = Object.freeze([{ section: 'branches', from: 'terraform', to: 'invade' }]);

function renamedKey(raw) {
  return RENAMED.find(({ section: name, from }) => {
    const value = raw?.[name];
    return value !== null && typeof value === 'object' && Object.hasOwn(value, from);
  });
}

function describeIssue(issue) {
  const path = issue.path.join('.') || '(top level)';
  const keys = issue.code === 'unrecognized_keys' ? ` (unrecognized: ${issue.keys.join(', ')})` : '';
  return `${path}: ${issue.message}${keys}`;
}

/**
 * The migrations from one `kit:` format to the next (PRD 347), in order: `{ from, migrate(raw) → raw }`,
 * each keeping every value and returning a file one `kit:` higher. None yet: `CONFIG_VERSION` is 1.
 * `omni update` runs them on the parsed YAML, in memory, before checking it; the file itself is never
 * rewritten by an update.
 */
export const MIGRATIONS = Object.freeze([]);

/** `raw` (parsed YAML) brought from its own `kit:` up through every migration that applies. */
export function migrateConfig(raw, migrations = MIGRATIONS) {
  let current = raw;
  for (const { from, migrate } of migrations) {
    if (current?.kit === from) current = migrate(current);
  }
  return current;
}

/**
 * Parses config text. Throws ConfigError whose FIRST line names `file` and the first offending key —
 * the CLI prints only that line — and whose later lines list every other issue. With `migrate`, the
 * migration step runs first, as `omni update` checks a file written for an older kit.
 */
export function parseConfig(source, file = CONFIG_FILE, { migrate = false } = {}) {
  let raw;
  try {
    raw = parse(source) ?? {};
  } catch (error) {
    throw new ConfigError(`${file}: not valid YAML — ${error.message.split('\n')[0]}`);
  }
  if (migrate) raw = migrateConfig(raw);
  const renamed = renamedKey(raw);
  if (renamed) {
    const { section: name, from, to } = renamed;
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${name}.${from} was renamed — call it ${name}.${to}`);
  }
  const result = ConfigSchema.safeParse(raw, { error: KIT_MESSAGES });
  if (!result.success) {
    const [first, ...others] = result.error.issues.map(describeIssue);
    const more = others.length ? `\n${others.map((line) => `  - ${line}`).join('\n')}` : '';
    throw new ConfigError(`${file} is not a valid Omni Loop config: ${first}${more}`);
  }
  return result.data;
}

/** Reads `<root>/.omni-loop/config.yml`. */
export function loadConfig(root) {
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new ConfigError(`This repository is not installed: ${CONFIG_FILE} is missing. Run \`omni-loop init\`.`);
  }
  return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
}
