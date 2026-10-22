// `omni bug film <n> --before <file> --after <file> [--out <dir>]` — the before/after GIF of a bug fix
// (PRD 1972) and the run's folder `omni proof push --kind bug` sends. Two `.txt` outputs (the
// reproduction red, then green) make two cards, drawn by the kit's own code with no ffmpeg
// (`../../lib/bug/film.ts`, PRD 2100); two `.webm` clips make the two clips, captioned, through
// ffmpeg. In `--out` (by default `<worktrees>/proof-bug-<n>/<YYYYMMDD-HHMMSS>/`) it writes
// `preview.gif`, the two inputs as `red.txt` and `green.txt` or `before.webm` and `after.webm`, and a
// `run.json` `readRun()` accepts. Prints the folder's path alone on its line, exit 0. Exit 1: a folder
// it cannot write (`could not write <path>`); for two clips also `ffmpeg not found`, or `ffmpeg
// failed: <its last line>`. Exit 2: a usage error (a missing file, a `.txt` beside a `.webm`, a
// number that is not one).
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copiedNames, filmArgs, filmGif, filmKind, runJson } from '../../lib/bug/film.ts';
import type { IssueNumber } from '../../lib/ids.ts';
import { errorMessage, inRoot, issueArg, parseArgs, println, repoSlug, usageError } from '../args.ts';
import type { CommandIo, Exec } from '../io.ts';

const USAGE = 'usage: omni bug film <n> --before <file> --after <file> [--out <dir>]';
const WRITE_ERROR = 'WriteError';

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYYMMDD-HHMMSS`, local time. */
function stamp(now: Date): string {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** The input file `path` (against the repository root), or a usage error when it is no file. */
function inputFile(ctx: { root: string }, flag: string, path: string | undefined): string {
  if (path === undefined) throw usageError(`${USAGE} (${flag} is needed)`);
  const file = inRoot(ctx, path);
  if (!existsSync(file) || !statSync(file).isFile()) throw usageError(`omni bug film: ${flag} ${path} is not a file.`);
  return file;
}

/** Whether ffmpeg runs on the PATH. */
function hasFfmpeg(exec: Exec): boolean {
  try {
    exec('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

/** The last non-empty line of what a failed ffmpeg wrote. */
function lastLine(error: unknown): string {
  const stderr: unknown = error instanceof Error && 'stderr' in error ? error.stderr : undefined;
  const text = typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf8') : errorMessage(error);
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? 'no output'
  );
}

/** Runs a write to `path`; when it fails, throws the error `film` prints as `could not write <path>`. */
function writing(path: string, write: () => void): void {
  try {
    write();
  } catch {
    throw Object.assign(new Error(`could not write ${path}`), { name: WRITE_ERROR });
  }
}

/** What `omni bug film` was asked for: the issue, the repository, the two inputs, what they are, and their text when they are text. */
type Ask = { issue: IssueNumber; slug: string; before: string; after: string; kind: 'text' | 'clips'; red: string; green: string; out: string | undefined };

/** The request in `args`, or a usage error. */
function askOf(args: string[], { ctx }: CommandIo): Ask {
  const { positional, flags } = parseArgs('bug film', args, { values: ['before', 'after', 'out'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const issue = issueArg('bug film', '<n>', positional[0]);
  const before = inputFile(ctx, '--before', flags.before);
  const after = inputFile(ctx, '--after', flags.after);
  const kind = filmKind(before, after);
  if (!kind) throw usageError('omni bug film: --before and --after are two .txt files or two .webm files.');
  const red = kind === 'text' ? readFileSync(before, 'utf8') : '';
  const green = kind === 'text' ? readFileSync(after, 'utf8') : '';
  return { issue, slug: repoSlug('bug film', ctx, undefined), before, after, kind, red, green, out: flags.out };
}

/** Copies `from` to `to`, or throws the write error. */
function copying(from: string, to: string): void {
  writing(to, () => {
    copyFileSync(from, to);
  });
}

/** Makes `preview.gif` in `out`: drawn by the kit for two outputs, stitched by ffmpeg for two clips. A failed ffmpeg's last line, else null. */
function makeGif({ kind, red, green }: Ask, out: string, exec: Exec): string | null {
  const gif = join(out, 'preview.gif');
  const [redName, greenName] = copiedNames(kind);
  if (kind === 'text') {
    writing(gif, () => {
      writeFileSync(gif, filmGif(red, green));
    });
    return null;
  }
  try {
    exec('ffmpeg', filmArgs({ before: join(out, redName), after: join(out, greenName), out: gif }), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (error) {
    return lastLine(error);
  }
}

/** The folder of a film: its inputs copied in, its GIF made, its `run.json` written. The exit code. */
function makeFolder(args: string[], io: CommandIo, now: Date): number {
  const { ctx, stdout, stderr, exec } = io;
  const ask = askOf(args, io);
  const { issue, before, after, kind, red, green } = ask;
  if (kind === 'clips' && !hasFfmpeg(exec)) {
    println(stderr, 'ffmpeg not found');
    return 1;
  }
  const out = ask.out === undefined ? join(ctx.root, ctx.config.worktrees, `proof-bug-${issue}`, stamp(now)) : inRoot(ctx, ask.out);
  const [redName, greenName] = copiedNames(kind);
  writing(out, () => {
    mkdirSync(out, { recursive: true });
  });
  copying(before, join(out, redName));
  copying(after, join(out, greenName));
  const failed = makeGif(ask, out, exec);
  if (failed !== null) {
    println(stderr, `ffmpeg failed: ${failed}`);
    return 1;
  }
  const commit = exec('git', ['rev-parse', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const url = `https://github.com/${ask.slug}/issues/${issue}`;
  const runFile = join(out, 'run.json');
  writing(runFile, () => {
    writeFileSync(runFile, `${JSON.stringify(runJson({ commit, url, kind, red, green }), null, 2)}\n`);
  });
  println(stdout, out);
  return 0;
}

/** Runs `omni bug film`; the exit code. `now` is a test's clock. */
export function film(args: string[], io: CommandIo, now: () => Date = () => new Date()): number {
  try {
    return makeFolder(args, io, now());
  } catch (error) {
    if (error instanceof Error && error.name === WRITE_ERROR) {
      println(io.stderr, error.message);
      return 1;
    }
    throw error;
  }
}
