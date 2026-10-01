// @ts-nocheck
// The plugin step of `omni init` (PRD 420): installs the kit's Claude Code plugin on the computer init
// runs on. `claude plugin marketplace add <kit home>` (skipped when the marketplace is there), then
// `claude plugin install omni@omni-loop`, with the names `omni update` uses. Nothing here throws: a
// plugin already installed is "already", and a missing `claude`, or a command that fails, leaves the
// two `/plugin` lines to type in Claude Code instead.
import { MARKETPLACE, PLUGIN } from './steps.ts';

const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 };
const ID = `${PLUGIN}@${MARKETPLACE}`;
const PLACEHOLDER_HOME = '<owner>/<kit repository>';

/** What `claude <args> --json` lists, or `null` when claude cannot say. */
function listed(exec, args) {
  try {
    const value = JSON.parse(exec('claude', [...args, '--json'], QUIET));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} o
 * @param {Function} o.exec
 * @param {string|null} o.kitHome   the `owner/name` the marketplace is added from
 * @returns {{ outcome: 'installed' | 'already' | 'failed' }}
 */
export function installPlugin({ exec, kitHome }) {
  if (listed(exec, ['plugin', 'list'])?.some((plugin) => plugin?.id === ID)) return { outcome: 'already' };
  if (!kitHome) return { outcome: 'failed' };
  try {
    const marketplaces = listed(exec, ['plugin', 'marketplace', 'list']);
    if (!marketplaces?.some((marketplace) => marketplace?.name === MARKETPLACE)) {
      exec('claude', ['plugin', 'marketplace', 'add', kitHome], QUIET);
    }
    exec('claude', ['plugin', 'install', ID], QUIET);
  } catch {
    return { outcome: 'failed' };
  }
  return { outcome: 'installed' };
}

/**
 * The plugin's status line, and the lines to type in Claude Code when it could not be installed.
 *
 * @returns {{ status: string[], todo: string[] }}
 */
export function pluginLines({ outcome }, { kitHome }) {
  if (outcome === 'installed') return { status: [`  plugin  installed ${ID}, run /reload-plugins in an open Claude Code`], todo: [] };
  if (outcome === 'already') return { status: [`  plugin  ${ID} installed already`], todo: [] };
  return {
    status: [`  plugin  could not install ${ID} from here`],
    todo: [`/plugin marketplace add ${kitHome ?? PLACEHOLDER_HOME}`, `/plugin install ${ID}`],
  };
}
