// The shapes every `omni` command is handed: where it writes, how it runs a process, and the
// repository context it works in. Types only: nothing here runs.
import type { ExecFileSyncOptions } from 'node:child_process';
import type { Context, ExecText } from '../lib/context.ts';

/** Where a command prints: `process.stdout`, `process.stderr`, or a test's buffer. */
export type Out = { write(text: string): unknown; isTTY?: boolean };

/** The environment a command reads: `process.env`, or a test's own. */
export type Env = Record<string, string | undefined>;

/**
 * How a command runs a process: `execFileSync`, or a test's fake. It is called both with a text
 * `encoding` (and returns the text) and without one, as the library modules it hands it to do.
 */
export type Exec = ExecText & ((file: string, args: readonly string[], options: ExecFileSyncOptions) => string | Buffer);

/** What a command that runs inside a repository is handed. */
export type CommandIo = { ctx: Context; stdout: Out; stderr: Out; exec: Exec; env: Env };

/** What a command marked `withoutContext` is handed, before its own injected options. */
export type FreeIo = { cwd: string; stdout: Out; stderr: Out; exec: Exec; env: Env };

/** A command that runs inside a repository: `omni config`, `omni prd`, … */
export type Command = { withoutContext?: false; run(args: string[], io: CommandIo): Promise<number> };

/** A command that runs before a config exists, or outside a repository: `omni init`, `omni ask`, … */
export type FreeCommand = { withoutContext: true; run(args: string[], io: FreeIo): Promise<number> };
