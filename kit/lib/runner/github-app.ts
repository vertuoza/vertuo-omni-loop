// What a job that runs as a GitHub App is started with (PRD 2433, s2): the bot as its identity and its
// commits' author, a git credential helper and an `insteadOf` that send every GitHub remote over HTTPS with
// the token, and a `gh` first on its `PATH` that runs the real one with that token. Both the helper and the
// `gh` read the token through `omni runner github-token`, whose command the runner is given: the token is
// never in a job's environment, a file git reads or a command line.
//
// A job with no app gets none of it: its environment is the runner's, as it always was.
import { accessSync, chmodSync, constants, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { gitConfigVariables, githubAppVariables } from '../env/read.ts';

/** `text` as one shell word: in single quotes, a quote inside it closed, escaped and opened again. */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

/** Where the runner keeps the `gh` it puts first on a job's `PATH`: beside the sign-in the kit keeps, not in a folder a person owns. */
export function ghShimDir(home: string): string {
  return join(home, '.config', 'omni', 'runner', 'bin');
}

/** The first executable `gh` on `path` outside `skip` (the shim's own folder), or `null`. */
export function findGh(path: string | undefined, skip: string): string | null {
  for (const dir of (path ?? '').split(delimiter)) {
    if (dir === '' || resolve(dir) === resolve(skip)) continue;
    const candidate = join(dir, 'gh');
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not here, or not runnable: the next folder.
    }
  }
  return null;
}

/**
 * The `gh` a job running as an app finds first. It reads the job's current token through `tokenCommand`
 * on every call, answers `gh auth token` with it (never the person's own login) and runs `realGh` with it
 * as `GH_TOKEN` for anything else. Without a real `gh`, it says so and exits 127, as a missing command does.
 */
export function ghShim(tokenCommand: readonly string[], realGh: string | null): string {
  const head = ['#!/bin/sh', '# The gh of a job that runs as a GitHub App (PRD 2433): written by omni runner, never by hand.'];
  if (realGh === null) return [...head, "echo 'gh: not found: this machine has no gh to run as the GitHub App' >&2", 'exit 127', ''].join('\n');
  return [
    ...head,
    `token=$(${tokenCommand.map(shellQuote).join(' ')}) || exit 1`,
    'if [ "$1" = auth ] && [ "$2" = token ]; then',
    '  printf \'%s\\n\' "$token"',
    '  exit 0',
    'fi',
    `GH_TOKEN="$token" exec ${shellQuote(realGh)} "$@"`,
    '',
  ].join('\n');
}

/** Writes the shim under `home` for the `gh` found on `path`, replacing the one there whole: the folder it is in. */
export function installGhShim({ home, tokenCommand, path }: { home: string; tokenCommand: readonly string[]; path: string | undefined }): string {
  const dir = ghShimDir(home);
  const file = join(dir, 'gh');
  const next = `${file}.${String(process.pid)}.tmp`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(next, ghShim(tokenCommand, findGh(path, dir)), { mode: 0o755 });
  chmodSync(next, 0o755);
  renameSync(next, file);
  return dir;
}

/** The git configuration that sends GitHub over HTTPS with the job's token, `tokenCommand` its credential helper (`--git`, then git's own `get`). */
function gitConfigOf(tokenCommand: readonly string[]): Record<string, string> {
  const helper = `!${[...tokenCommand, '--git'].map(shellQuote).join(' ')}`;
  return gitConfigVariables([
    // Only for GitHub's HTTPS URLs, and first emptied: another helper (a keychain) never answers for the app.
    ['credential.https://github.com.helper', ''],
    ['credential.https://github.com.helper', helper],
    ['url.https://github.com/.insteadOf', 'git@github.com:'],
    ['url.https://github.com/.insteadOf', 'ssh://git@github.com/'],
  ]);
}

/**
 * The variables a job running as the app `bot` starts with, on top of the runner's own: the app as its
 * identity, git over HTTPS with the token, and the shim's folder first on `path`.
 */
export function githubJobEnv({ bot, tokenCommand, shimDir, path }: { bot: { login: string; email: string }; tokenCommand: readonly string[]; shimDir: string; path: string | undefined }): Record<string, string> {
  return {
    ...githubAppVariables(bot),
    ...gitConfigOf(tokenCommand),
    PATH: path === undefined || path === '' ? shimDir : `${shimDir}${delimiter}${path}`,
  };
}
