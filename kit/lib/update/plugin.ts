// The last step of `omni update` (PRD 347, s4): the Claude plugin on the machine that runs it.
// `claude plugin marketplace update`, then `claude plugin update`, for the kit's marketplace and
// plugin. With no `claude`, or one that fails, it prints the two lines to type in Claude Code
// instead: a plugin that did not update stops nothing.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ExecText } from '../context.ts';
import { MARKETPLACE, PLUGIN } from '../init/steps.ts';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 };

/** Updates the plugin through `claude`, or says how to by hand. Returns whether it updated. */
export function updatePlugin({ version = null, exec, println }: { version?: string | null; exec: ExecText; println: (line: string) => void }): boolean {
  try {
    exec('claude', ['plugin', 'marketplace', 'update', MARKETPLACE], QUIET);
    exec('claude', ['plugin', 'update', `${PLUGIN}@${MARKETPLACE}`], QUIET);
  } catch {
    println('  plugin   not updated from here; in Claude Code, type:');
    println(`     /plugin marketplace update ${MARKETPLACE}`);
    println(`     /plugin update ${PLUGIN}@${MARKETPLACE}`);
    return false;
  }
  println(`  plugin   updated${version ? ` to v${version}` : ''}, run /reload-plugins`);
  return true;
}
