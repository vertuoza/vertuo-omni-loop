// The shapes every `omni` command is handed: where it writes, how it runs a process, and the
// repository context it works in. Types only: nothing here runs.
import type { Context, ExecRaw, ExecText } from '../lib/context.ts';
import type { KitEnv } from '../lib/env/read.ts';

/** Where a command prints: `process.stdout`, `process.stderr`, or a test's buffer. */
export type Out = { write(text: string): unknown; isTTY?: boolean };

/**
 * The process's environment as a command was handed it (`process.env`, or a test's own): passed on
 * whole to the processes it runs. A command reads its own settings from `vars`, never from here.
 */
export type Env = Record<string, string | undefined>;

/** The environment's groups, read once by `main()` (`../lib/env/read.ts`). */
export type Vars = KitEnv;

/**
 * How a command runs a process: `execFileSync`, or a test's fake. It is called both with a text
 * `encoding` (and returns the text) and without one, as the library modules it hands it to do.
 */
export type Exec = ExecText & ExecRaw;

/** What a command that runs inside a repository is handed. */
export type CommandIo = { ctx: Context; stdout: Out; stderr: Out; exec: Exec; env: Env; vars: Vars };

/** What a command marked `withoutContext` is handed, before its own injected options. */
export type FreeIo = { cwd: string; stdout: Out; stderr: Out; exec: Exec; env: Env; vars: Vars };

/** A command that runs inside a repository: `omni config`, `omni prd`, … */
export type Command = { withoutContext?: false; run(args: string[], io: CommandIo): Promise<number> };

/** A command that runs before a config exists, or outside a repository: `omni init`, `omni ask`, … */
export type FreeCommand = { withoutContext: true; run(args: string[], io: FreeIo): Promise<number> };
