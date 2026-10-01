// @ts-nocheck
// The one object every kit function receives instead of a repository root: where the repository is,
// what its config says, where its PRDs live, and which markers its comments carry.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { ConfigError, loadConfig } from './config.ts';
import { foldersLayout } from './layout.ts';
import { makeMarkers } from './markers.ts';

export function createContext(root, config) {
  return Object.freeze({
    root,
    config,
    layout: foldersLayout(root, config.paths),
    markers: makeMarkers(config.markers.prefix),
  });
}

export function slugFromRemote(url) {
  const match = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

export function loadContext(cwd = process.cwd(), { exec = execFileSync } = {}) {
  let root;
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
