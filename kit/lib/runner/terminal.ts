// Where a runner's job runs (PRD 1830): a detached tmux session named `job-<id>`, so that a person
// can attach to it over SSH, started with the job's own environment and a command given as separate
// arguments, which tmux runs directly, never through a shell. Before it registers, the runner checks
// the tools a job needs: `claude` installed and signed in, and tmux.
import type { ExecText } from '../context.ts';

/** One job's session: its name, the folder it starts in, the variables it adds, and the command it runs. */
export type JobSession = { name: string; cwd: string; env: Readonly<Record<string, string>>; argv: readonly string[] };

/** Starts and stops a job's session: tmux, or a test's own. */
export type Terminal = {
  start(session: JobSession): void;
  stop(name: string): void;
  /** Whether the session still runs its command: false once it ended, or when it is gone. */
  alive(name: string): boolean;
};

/** The arguments of `tmux` that start `session`, detached. */
export function tmuxArgs(session: JobSession): string[] {
  const env = Object.entries(session.env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  return ['new-session', '-d', '-s', session.name, '-c', session.cwd, ...env, ...session.argv];
}

export function tmuxTerminal(exec: ExecText): Terminal {
  return {
    start(session) {
      exec('tmux', tmuxArgs(session), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    },
    stop(name) {
      try {
        exec('tmux', ['kill-session', '-t', name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch {
        // A session that already ended has nothing left to stop.
      }
    },
    alive(name) {
      // A pane kept after its command ended (`remain-on-exit`) reads `1`; a session that is gone throws.
      try {
        return exec('tmux', ['list-panes', '-t', name, '-F', '#{pane_dead}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n').includes('0');
      } catch {
        return false;
      }
    },
  };
}

/** Whether `file args` runs and exits 0, with its output. */
function runs(exec: ExecText, file: string, args: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: exec(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 }) };
  } catch {
    return { ok: false, out: '' };
  }
}

/** What a runner needs of `claude` on its own machine: `login` is a signed-in install (no accounts file, as ever), `installed` an install (direct accounts hold their own sign-in), `none` nothing (PRD 2537). */
export type ClaudeNeed = 'login' | 'installed' | 'none';

/**
 * The one line saying which tool a job needs is missing, or `null` when all are here: `claude` installed
 * and, unless the accounts file gives every direct account its own secret, signed in (`claude auth
 * status`), and tmux.
 */
export function missingTool(exec: ExecText, claude: ClaudeNeed = 'login'): string | null {
  if (claude !== 'none' && !runs(exec, 'claude', ['--version']).ok) return 'claude is not installed: install Claude Code, then start the runner again';
  if (claude === 'login') {
    const status = runs(exec, 'claude', ['auth', 'status']);
    if (!status.ok || /"loggedIn"\s*:\s*false/.test(status.out)) return 'claude is not signed in: run claude auth login, then start the runner again';
  }
  if (!runs(exec, 'tmux', ['-V']).ok) return 'tmux is not installed: install it, then start the runner again';
  return null;
}
