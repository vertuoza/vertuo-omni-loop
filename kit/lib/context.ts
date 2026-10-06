// The one object every kit function receives instead of a repository root: where the repository is,
// what its config says, where its PRDs live, and which markers its comments carry.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions, ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { ConfigError, loadConfig } from './config.ts';
import { foldersLayout } from './layout.ts';
import { makeMarkers } from './markers.ts';
import type { Config } from './types.ts';

/** A process runner shaped like `execFileSync` called with a text `encoding`: it returns stdout. */
export type ExecText = (file: string, args: readonly string[], options: ExecFileSyncOptionsWithStringEncoding) => string;

/** A process runner shaped like `execFileSync`: stdout as text with an `encoding`, a Buffer without. */
export type ExecRaw = (file: string, args: readonly string[], options: ExecFileSyncOptions) => string | Buffer;

/** The one object every kit function receives: the repository's root, config, layout and markers. */
export type Context = ReturnType<typeof createContext>;

export function createContext(root: string, config: Config) {
  // Named key by key: the four `paths` keys the layout reads, typed one by one from the config.
  const { delivery, adr, knowledge, playbook } = config.paths;
  return Object.freeze({
    root,
    config,
    layout: foldersLayout(root, { delivery, adr, knowledge, playbook }),
    markers: makeMarkers(config.markers.prefix),
  });
}

export function slugFromRemote(url: string): string | null {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

export function loadContext(cwd: string = process.cwd(), { exec = execFileSync }: { exec?: ExecText } = {}): Context {
  let root: string;
  try {
    root = exec('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    throw new ConfigError(`${cwd} is not inside a git repository.`);
  }
  root = realpathSync(root);
  let config = loadConfig(root);
  if (config.repo.slug === null) {
    let url = '';
    try {
      url = exec('git', ['remote', 'get-url', config.repo.remote], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      url = '';
    }
    config = { ...config, repo: { ...config.repo, slug: slugFromRemote(url) } };
  }
  return createContext(root, config);
}
