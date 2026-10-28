// A runner's token counts, read from Claude's transcripts (PRD 2102, "The runner counts tokens"):
// `~/.claude/projects/<folder>/**/*.jsonl`, one folder per directory Claude ran in, named after it with
// every character that is not a letter or a digit turned into `-`. The sum is the one ask rounds use
// (`usageSum` in `../ask/context.ts`): `message.usage` over assistant entries, each message id once.
// A runner with T3 accounts (PRD 2537) reads each Claude instance's own folder beside its own.
//
// - A job's tokens: every transcript whose folder is the job's worktree, or below it (the worktrees a
//   wave's sub-agents run in sit under the job's `.claude/worktrees/`). `job-12` is not `job-123`.
// - The machine's tokens: every transcript, in two windows: entries stamped in the last 5 hours, and
//   entries since midnight UTC. Only files modified within the wider window are opened.
// - A file is read again only when its size or modification time changed since the last count.
// - A count that cannot be read (no projects folder, a file refused) is `null`, never `0`.
//
// Only numbers come out of here: no path, no transcript text.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { usageSum } from '../ask/context.ts';
import type { TokenCounts } from '../ask/context.ts';
import { field } from '../ask/schema.ts';

export type { TokenCounts };

/** The machine's tokens over the last 5 hours and since midnight UTC. */
export type MachineTokens = { last5h: TokenCounts; today: TokenCounts };

/** Where the runner reads its token counts from. */
export type TokenSource = {
  /** The tokens of the job whose worktree is `worktree`, sub-agents included; `null` when unreadable. */
  job(worktree: string): TokenCounts | null;
  /** The machine's tokens in both windows; `null` when unreadable. */
  machine(): MachineTokens | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The folder Claude keeps the transcripts of a session run in `path`: every character but a letter or a digit is `-`. */
export const projectFolder = (path: string): string => path.replace(/[^A-Za-z0-9]/g, '-');

/** One assistant message of a transcript: its id (`null` when it has none), when it was stamped, and its usage. */
type Entry = { id: string | null; at: number | null; usage: object };

/** A transcript's entries, and the size and time they were read at. */
type Read = { size: number; mtimeMs: number; entries: Entry[] };

/** The assistant message one line of a transcript holds, or `null` for any other line. */
function entryOf(raw: string): Entry | null {
  let entry: unknown;
  try {
    entry = JSON.parse(raw);
  } catch {
    return null;
  }
  if (field(entry, 'type') !== 'assistant') return null;
  const message = field(entry, 'message');
  const usage = field(message, 'usage');
  if (!usage || typeof usage !== 'object') return null;
  const id = field(message, 'id');
  const stamp = field(entry, 'timestamp');
  const at = typeof stamp === 'string' ? Date.parse(stamp) : Number.NaN;
  return { id: typeof id === 'string' ? id : null, at: Number.isNaN(at) ? null : at, usage };
}

const entriesOf = (text: string): Entry[] => text.split('\n').flatMap((raw) => (raw.trim() ? [entryOf(raw)] : [])).filter((entry) => entry !== null);

const missing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

/**
 * The token counts of the transcripts under `projects`: one Claude folder, or several (the machine's own
 * and each T3 instance's, PRD 2537), each read once. A folder that does not exist yet counts as empty;
 * the counts are `null` when none exists. `readFile` is the read of a transcript's text, which a test
 * counts; `now` is the clock.
 */
export function tokenSource({ projects, now = Date.now, readFile = (path) => readFileSync(path, 'utf8') }: {
  projects: string | readonly string[];
  now?: (() => number) | undefined;
  readFile?: ((path: string) => string) | undefined;
}): TokenSource {
  const roots = [...new Set(typeof projects === 'string' ? [projects] : projects)];
  const cache = new Map<string, Read>();

  /** The entries of the transcript at `path`, read again only when its size or time changed; `[]` when it is older than `since` or gone, `null` when refused. */
  function entriesAt(path: string, since: number): Entry[] | null {
    try {
      const stats = statSync(path);
      if (!stats.isFile() || stats.mtimeMs < since) return [];
      let held = cache.get(path);
      if (held?.size !== stats.size || held.mtimeMs !== stats.mtimeMs) {
        held = { size: stats.size, mtimeMs: stats.mtimeMs, entries: entriesOf(readFile(path)) };
        cache.set(path, held);
      }
      return held.entries;
    } catch (error) {
      return missing(error) ? [] : null;
    }
  }

  /** The transcripts under one project folder of `root`, by their names; `null` when the folder is refused. */
  function transcriptNames(root: string, folder: string): string[] | null {
    try {
      return readdirSync(join(root, folder), { recursive: true, encoding: 'utf8' }).filter((name) => name.endsWith('.jsonl'));
    } catch (error) {
      return missing(error) ? [] : null;
    }
  }

  /** The transcripts of `root`'s folders `wanted` accepts, modified at `since` or after; `'missing'` when `root` does not exist, `null` when one cannot be read. */
  function transcriptsIn(root: string, wanted: (folder: string) => boolean, since: number): Entry[][] | 'missing' | null {
    let folders: string[];
    try {
      folders = readdirSync(root).filter(wanted);
    } catch (error) {
      return missing(error) ? 'missing' : null;
    }
    const found: Entry[][] = [];
    for (const folder of folders) {
      const names = transcriptNames(root, folder);
      if (names === null) return null;
      for (const name of names) {
        const entries = entriesAt(join(root, folder, name), since);
        if (entries === null) return null;
        found.push(entries);
      }
    }
    return found;
  }

  /** The transcripts of every root's folders `wanted` accepts; `null` when one cannot be read, or when no root exists. */
  function transcripts(wanted: (folder: string) => boolean, since: number): Entry[][] | null {
    const found: Entry[][] = [];
    let present = false;
    for (const root of roots) {
      const inRoot = transcriptsIn(root, wanted, since);
      if (inRoot === null) return null;
      if (inRoot === 'missing') continue;
      present = true;
      found.push(...inRoot);
    }
    return present ? found : null;
  }

  /** The sum of the entries stamped at `from` or after (all of them when `from` is `null`), each message id once, the last entry of an id counting. */
  function sum(files: readonly Entry[][], from: number | null): TokenCounts {
    const usages = new Map<string, object>();
    let anonymous = 0;
    for (const entries of files) {
      for (const { id, at, usage } of entries) {
        if (from !== null && (at === null || at < from)) continue;
        usages.set(id ?? `#${String(anonymous++)}`, usage);
      }
    }
    return usageSum(usages.values());
  }

  return {
    job(worktree) {
      const folder = projectFolder(worktree);
      const found = transcripts((name) => name === folder || name.startsWith(`${folder}-`), 0);
      return found === null ? null : sum(found, null);
    },
    machine() {
      const at = now();
      const midnight = at - (at % DAY_MS);
      const last5h = at - 5 * HOUR_MS;
      const found = transcripts(() => true, Math.min(midnight, last5h));
      return found === null ? null : { last5h: sum(found, last5h), today: sum(found, midnight) };
    },
  };
}
