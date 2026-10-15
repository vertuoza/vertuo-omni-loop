// `omni bug film <n> --before <file> --after <file> [--out <dir>]` — the before/after GIF of a bug fix
// (PRD 1972) and the run's folder `omni proof push --kind bug` sends. Two `.txt` outputs (the
// reproduction red, then green) make two cards, two `.webm` clips make the two clips, captioned, drawn
// with ffmpeg alone (`../../lib/bug/film.ts`). In `--out` (by default
// `<worktrees>/proof-bug-<n>/<YYYYMMDD-HHMMSS>/`) it writes `preview.gif`, the two inputs as `red.txt`
// and `green.txt` or `before.webm` and `after.webm`, and a `run.json` `readRun()` accepts. Prints the
// folder's path alone on its line, exit 0. Exit 1: `ffmpeg not found`, or `ffmpeg failed: <its last
// line>`. Exit 2: a usage error (a missing file, a `.txt` beside a `.webm`, a number that is not one).
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cardText, copiedNames, filmArgs, filmKind, runJson } from '../../lib/bug/film.ts';
import { errorMessage, inRoot, issueArg, parseArgs, println, repoSlug, usageError } from '../args.ts';
import type { CommandIo, Exec } from '../io.ts';

const USAGE = 'usage: omni bug film <n> --before <file> --after <file> [--out <dir>]';

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
  const stderr = (error as { stderr?: unknown } | null)?.stderr;
  const text = typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf8') : errorMessage(error);
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? 'no output'
  );
}

/** Runs `omni bug film`; the exit code. `now` is a test's clock. */
export function film(args: string[], { ctx, stdout, stderr, exec }: CommandIo, now: () => Date = () => new Date()): number {
  const { positional, flags } = parseArgs('bug film', args, { values: ['before', 'after', 'out'] });
  if (positional.length !== 1) throw usageError(USAGE);
  const issue = issueArg('bug film', '<n>', positional[0]);
  const before = inputFile(ctx, '--before', flags.before);
  const after = inputFile(ctx, '--after', flags.after);
  const kind = filmKind(before, after);
  if (!kind) throw usageError('omni bug film: --before and --after are two .txt files or two .webm files.');
  const slug = repoSlug('bug film', ctx, undefined);

  if (!hasFfmpeg(exec)) {
    println(stderr, 'ffmpeg not found');
    return 1;
  }
  const out = flags.out === undefined ? join(ctx.root, ctx.config.worktrees, `proof-bug-${issue}`, stamp(now())) : inRoot(ctx, flags.out);
  mkdirSync(out, { recursive: true });
  const [redName, greenName] = copiedNames(kind);
  copyFileSync(before, join(out, redName));
  copyFileSync(after, join(out, greenName));
  const gif = join(out, 'preview.gif');

  const scratch = mkdtempSync(join(tmpdir(), 'omni-bug-film-'));
  try {
    const red = kind === 'text' ? readFileSync(before, 'utf8') : '';
    const green = kind === 'text' ? readFileSync(after, 'utf8') : '';
    let input;
    if (kind === 'text') {
      const redCard = join(scratch, 'red-card.txt');
      const greenCard = join(scratch, 'green-card.txt');
      writeFileSync(redCard, cardText(red));
      writeFileSync(greenCard, cardText(green));
      input = { kind, red: redCard, green: greenCard, out: gif } as const;
    } else {
      input = { kind, before: join(out, redName), after: join(out, greenName), out: gif } as const;
    }
    try {
      exec('ffmpeg', filmArgs(input), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      println(stderr, `ffmpeg failed: ${lastLine(error)}`);
      return 1;
    }
    const commit = exec('git', ['rev-parse', 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const url = `https://github.com/${slug}/issues/${issue}`;
    writeFileSync(join(out, 'run.json'), `${JSON.stringify(runJson({ commit, url, kind, red, green }), null, 2)}\n`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  println(stdout, out);
  return 0;
}
