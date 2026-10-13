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

/**
 * The one line saying which tool a job needs is missing, or `null` when all are here: `claude`
 * installed, `claude` signed in (`claude auth status`), and tmux.
 */
export function missingTool(exec: ExecText): string | null {
  if (!runs(exec, 'claude', ['--version']).ok) return 'claude is not installed: install Claude Code, then start the runner again';
  const status = runs(exec, 'claude', ['auth', 'status']);
  if (!status.ok || /"loggedIn"\s*:\s*false/.test(status.out)) return 'claude is not signed in: run claude auth login, then start the runner again';
  if (!runs(exec, 'tmux', ['-V']).ok) return 'tmux is not installed: install it, then start the runner again';
  return null;
}
