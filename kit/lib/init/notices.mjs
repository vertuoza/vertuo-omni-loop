// What `omni init` warns about, read from the repository and never acted on: an older copy of the loop
// already running in it, and a formatter whose check would reject the bundled bin. `init` writes only
// under `.omni-loop/`, so each notice is a step for a person, not an edit.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS = join('.github', 'workflows');
const PRETTIER_CONFIGS = [
  '.prettierrc', '.prettierrc.json', '.prettierrc.json5', '.prettierrc.yml', '.prettierrc.yaml', '.prettierrc.toml',
  '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.mjs', 'prettier.config.js', 'prettier.config.cjs',
  'prettier.config.mjs', 'prettier.config.ts',
];
const PRETTIER_IGNORE = '.prettierignore';
const BIOME_CONFIGS = ['biome.json', 'biome.jsonc'];

function read(root, path) {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

/**
 * The workflows of an older, hand-copied loop: the omni-loop App posts the outbox check itself and the
 * kit installs no workflow, so any workflow that mentions the outbox belongs to another copy.
 * @returns {string[]} their repository paths, sorted
 */
export function legacyLoopWorkflows(root) {
  let names = [];
  try {
    names = readdirSync(join(root, WORKFLOWS));
  } catch {
    return [];
  }
  return names
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => join(WORKFLOWS, name))
    .filter((path) => /outbox/i.test(read(root, path) ?? ''))
    .sort();
}

/** Whether an ignore file's text already covers `dir` (a line naming it, with or without slashes). */
function ignores(text, dir) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line && !line.startsWith('#') && line.replace(/^\/+/, '').startsWith(dir));
}

/**
 * The formatter that would check `<dir>/bin/`, and where to exclude it — or `null` when none is
 * configured or it already excludes the folder.
 * @param {string} root
 * @param {string} dir  the folder init owns (`.omni-loop`)
 * @returns {{ tool: string, file: string } | null}
 */
export function formatterToExclude(root, dir) {
  const pkg = read(root, 'package.json');
  let prettierInPackage = false;
  try {
    prettierInPackage = pkg !== null && Object.hasOwn(JSON.parse(pkg), 'prettier');
  } catch {
    prettierInPackage = false;
  }
  if (prettierInPackage || PRETTIER_CONFIGS.some((file) => existsSync(join(root, file)))) {
    const ignore = read(root, PRETTIER_IGNORE);
    return ignore !== null && ignores(ignore, dir) ? null : { tool: 'Prettier', file: PRETTIER_IGNORE };
  }
  const biome = BIOME_CONFIGS.find((file) => existsSync(join(root, file)));
  if (biome) return (read(root, biome) ?? '').includes(dir) ? null : { tool: 'Biome', file: biome };
  return null;
}
