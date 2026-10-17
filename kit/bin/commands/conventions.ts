// `omni conventions [--root <dir>] [--json]` (PRD 2049): the index of the files where a directory
// writes its conventions (`kit/lib/conventions/conventions.ts`): path, title and the file that led to
// it, `missing` for a broken link. It reads files only and needs no omni config, so it runs before a
// context exists, on the current directory or on a clone with `--root`. A `--root` that is not a
// directory prints one line and exits 1.
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConventions } from '../../lib/conventions/conventions.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo } from '../io.ts';

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export const conventions: FreeCommand = {
  withoutContext: true,
  run(args: string[], io: FreeIo): Promise<number> {
    const { positional, flags } = parseArgs('conventions', args, { values: ['root'], booleans: ['json'] });
    if (positional.length) throw usageError('usage: omni conventions [--root <dir>] [--json]');
    const root = resolve(io.cwd, flags.root ?? '.');
    if (!isDirectory(root)) {
      println(io.stdout, `omni conventions: ${flags.root ?? root} is not a directory.`);
      return Promise.resolve(1);
    }
    const entries = readConventions(root);
    if (flags.json) println(io.stdout, JSON.stringify(entries, null, 2));
    else if (entries.length === 0) println(io.stdout, 'no written conventions found');
    else for (const entry of entries) println(io.stdout, `${entry.path}  ${entry.missing ? 'missing' : entry.title}  (from ${entry.from})`);
    return Promise.resolve(0);
  },
};
