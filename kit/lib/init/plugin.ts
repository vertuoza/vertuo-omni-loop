// The plugin step of `omni init` (PRD 420): installs the kit's Claude Code plugin on the computer init
// runs on. `claude plugin marketplace add <kit home>` (skipped when the marketplace is there), then
// `claude plugin install omni@omni-loop`, with the names `omni update` uses. Nothing here throws: a
// plugin already installed is "already", and a missing `claude`, or a command that fails, leaves the
// two `/plugin` lines to type in Claude Code instead.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { z } from 'zod';
import type { ExecText } from '../context.ts';
import { ClaudeMarketplacesSchema, ClaudePluginsSchema } from './schema.ts';
import { MARKETPLACE, PLUGIN } from './steps.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 };

/** What the plugin step did. */
export type PluginOutcome = { outcome: 'installed' | 'already' | 'failed' };

/** A step's status lines, and the lines left to type when it could not be done. */
export type StepLines = { status: string[]; todo: string[] };
const ID = `${PLUGIN}@${MARKETPLACE}`;
const PLACEHOLDER_HOME = '<owner>/<kit repository>';

/** What `claude <args> --json` lists, or `null` when claude cannot say. */
function listed<S extends z.ZodType>(exec: ExecText, args: string[], schema: S): z.infer<S> | null {
  try {
    const parsed = schema.safeParse(JSON.parse(exec('claude', [...args, '--json'], QUIET)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * `kitHome` is the `owner/name` the marketplace is added from.
 */
export function installPlugin({ exec, kitHome }: { exec: ExecText; kitHome: string | null }): PluginOutcome {
  if (listed(exec, ['plugin', 'list'], ClaudePluginsSchema)?.some((plugin) => plugin?.id === ID)) return { outcome: 'already' };
  if (!kitHome) return { outcome: 'failed' };
  try {
    const marketplaces = listed(exec, ['plugin', 'marketplace', 'list'], ClaudeMarketplacesSchema);
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
 */
export function pluginLines({ outcome }: PluginOutcome, { kitHome }: { kitHome: string | null }): StepLines {
  if (outcome === 'installed') return { status: [`  plugin  installed ${ID}, run /reload-plugins in an open Claude Code`], todo: [] };
  if (outcome === 'already') return { status: [`  plugin  ${ID} installed already`], todo: [] };
  return {
    status: [`  plugin  could not install ${ID} from here`],
    todo: [`/plugin marketplace add ${kitHome ?? PLACEHOLDER_HOME}`, `/plugin install ${ID}`],
  };
}
