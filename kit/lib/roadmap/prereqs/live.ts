/**
 * **The machine, for real** (PRD 1218, slice s2): the command runner and the files a prerequisites run
 * uses outside tests, and the name a result is kept under. Every check goes through these, so a test
 * hands in stubs instead and never touches the machine.
 *
 * A command runs without a shell (a row's own check names `sh` itself), in the folder given, and is
 * killed once past its limit (`code: null`); one that cannot start rejects, which the runner reads as
 * a crash, never as ok.
 */
import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';
import { constants, copyFileSync, existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import type { PrereqEnv, RepoFiles, Shell } from './catalog.ts';

/** More than any check prints. */
const MAX_OUTPUT = 4 * 1024 * 1024;

/** Whether `error` is a process that ran and failed, rather than one that could not start. */
const ranAndFailed = (error: ExecFileException): boolean => typeof error.code === 'number' || error.killed === true || error.signal != null;

export const liveShell: Shell = (file, args, { cwd, timeoutMs }) =>
  new Promise((resolve, reject) => {
    execFile(file, [...args], { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error === null) resolve({ code: 0, stdout, stderr });
      else if (ranAndFailed(error)) resolve({ code: typeof error.code === 'number' ? error.code : null, stdout, stderr });
      else reject(new Error(error.message, { cause: error }));
    });
  });

/** The repository's files under `root`. */
export function liveFiles(root: string): RepoFiles {
  const at = (path: string) => join(root, path);
  return {
    exists: (path) => existsSync(at(path)),
    read: (path) => {
      try {
        return readFileSync(at(path), 'utf8');
      } catch {
        return null;
      }
    },
    copyNew: (from, to) => {
      try {
        copyFileSync(at(from), at(to), constants.COPYFILE_EXCL);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The environment a run on this machine uses, in the repository at `root`. */
export function liveEnv({ root, labels, signedIn }: Pick<PrereqEnv, 'root' | 'labels' | 'signedIn'>): PrereqEnv {
  return { root, shell: liveShell, files: liveFiles(root), labels, signedIn };
}

/** This machine's name, the one its results are kept and shown under. */
export function machineName(): string {
  return hostname();
}
