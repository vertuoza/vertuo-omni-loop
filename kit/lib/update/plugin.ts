// The Claude plugin on the machine that runs it (PRD 347, s4; PRD 2100, s4).
// `claude plugin marketplace update`, then `claude plugin update`, for the kit's marketplace and
// plugin. `omni update` ends on it (`updatePlugin`): with no `claude`, or one that fails, it prints
// the two lines to type in Claude Code instead, since a plugin that did not update stops nothing.
// `omni runner` runs it unattended (`runPluginUpdate`) and wants what the update said last.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ExecText } from '../context.ts';
import { MARKETPLACE, PLUGIN } from '../init/steps.ts';
import { messageOf, propertyOf } from '../narrow.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 };

/** The longest line the update's last words may be. */
const SAID_MAX = 200;

/** What the two `claude` calls ended on: whether both ran, and the last line they said. */
export type PluginUpdate = { readonly updated: boolean; readonly said: string };

/** The last line of `text` that holds anything, cut to `SAID_MAX`, or `null` when none does. */
function lastLine(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const line = text.split(/\r?\n/).map((each) => each.trim()).findLast((each) => each !== '');
  return line === undefined ? null : line.slice(0, SAID_MAX);
}

/** What a failed `claude` call said: its last standard error line, else its last output line, else its message. */
function saidByFailure(error: unknown): string {
  return lastLine(propertyOf(error, 'stderr')) ?? lastLine(propertyOf(error, 'stdout')) ?? lastLine(messageOf(error)) ?? 'no output';
}

/**
 * Updates the plugin through `claude`, quietly: `updated` once both calls ran, and `said` the last
 * line the plugin update printed (what a call that failed printed, when one did).
 */
export function runPluginUpdate(exec: ExecText): PluginUpdate {
  try {
    exec('claude', ['plugin', 'marketplace', 'update', MARKETPLACE], QUIET);
    const printed = exec('claude', ['plugin', 'update', `${PLUGIN}@${MARKETPLACE}`], QUIET);
    return { updated: true, said: lastLine(printed) ?? 'no output' };
  } catch (error) {
    return { updated: false, said: saidByFailure(error) };
  }
}

/** Updates the plugin through `claude`, or says how to by hand. Returns whether it updated. */
export function updatePlugin({ version = null, exec, println }: { version?: string | null; exec: ExecText; println: (line: string) => void }): boolean {
  if (!runPluginUpdate(exec).updated) {
    println('  plugin   not updated from here; in Claude Code, type:');
    println(`     /plugin marketplace update ${MARKETPLACE}`);
    println(`     /plugin update ${PLUGIN}@${MARKETPLACE}`);
    return false;
  }
  println(`  plugin   updated${version ? ` to v${version}` : ''}, run /reload-plugins`);
  return true;
}
