// The repositories a runner holds (PRD 1830): the git checkouts right under `--repos`, each known by
// its `origin` as `owner/name`. A folder that is no checkout, or whose origin reads as no
// `owner/name`, is left out.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';

/** `owner/name` of a remote's URL (`git@github.com:owner/name.git`, `https://host/owner/name`), or `null`. */
export function repoOfRemote(url: string): string | null {
  const match = /[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url.trim());
  if (!match) return null;
  return `${match[1] ?? ''}/${match[2] ?? ''}`;
}

/** Each checkout under `dir`, by `owner/name`, sorted; the first folder wins when two share an origin. */
export function listCheckouts(dir: string, exec: ExecText): Map<string, string> {
  const found = new Map<string, string>();
  let names: string[];
  try {
    names = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return found;
  }
  for (const name of names) {
    const path = join(dir, name);
    if (!existsSync(join(path, '.git'))) continue;
    let url: string;
    try {
      url = exec('git', ['-C', path, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      continue;
    }
    const repo = repoOfRemote(url);
    if (repo && !found.has(repo)) found.set(repo, path);
  }
  return new Map([...found].sort(([a], [b]) => a.localeCompare(b)));
}
