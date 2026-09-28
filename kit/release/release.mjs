#!/usr/bin/env node
// Cuts the kit's next release (PRD #347), from a checkout of `main` with its whole history and
// tags. The `release` workflow (`.github/workflows/release.yml`) runs it after every push to `main`,
// and does nothing else. It:
//
// 1. does nothing, exit 0, when the head commit is itself a release commit;
// 2. takes the next version from the tags (`next-version.mjs`);
// 3. writes it into `package.json` and `kit/plugin/.claude-plugin/plugin.json`;
// 4. runs `pnpm kit:build`, so the bundle carries it too;
// 5. commits those three files as `chore(release): v0.0.N`, signed with `omni sign trailer`;
// 6. pushes the commit to `main`; when that is rejected because `main` moved, rebases onto it once
//    (rebuilding the bundle, and amending the commit when the rebuild changed it) and pushes again.
//    A second failure exits 1 with nothing tagged: the next merge takes the next number;
// 7. tags `v0.0.N`, pushes the tag, and creates the GitHub Release with the bundle attached and
//    notes GitHub generates.
//
// Every call to `git`, `pnpm`, `node` and `gh` goes through the injected `exec`, so the tests fake
// them all and never reach GitHub.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isReleaseSubject, nextVersion } from './next-version.mjs';

const REMOTE = 'origin';
const BRANCH = 'main';
const PACKAGE = 'package.json';
const PLUGIN = 'kit/plugin/.claude-plugin/plugin.json';
const BUNDLE = 'kit/dist/omni.mjs';

/** `package.json` with `version` set, placed right after `name` when it is new. */
function withVersion(manifest, version) {
  if ('version' in manifest) return { ...manifest, version };
  const out = {};
  let placed = false;
  for (const [key, value] of Object.entries(manifest)) {
    out[key] = value;
    if (key === 'name') {
      out.version = version;
      placed = true;
    }
  }
  return placed ? out : { version, ...manifest };
}

function stamp(root, path, version) {
  const file = join(root, path);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  writeFileSync(file, `${JSON.stringify(withVersion(manifest, version), null, 2)}\n`);
}

/** Runs one command, and says whether it succeeded, instead of throwing. */
function attempt(exec, cmd, args, log) {
  try {
    exec(cmd, args);
    return true;
  } catch (error) {
    log(`${cmd} ${args.join(' ')} failed: ${String(error.message).trim()}`);
    return false;
  }
}

/**
 * Cuts one release. Returns the exit code: 0 when a release was published or none was due, 1 when
 * it failed.
 *
 * @param {{ root: string, exec: (cmd: string, args: string[]) => string, log?: (line: string) => void }} options
 * @returns {number}
 */
export function release({ root, exec, log = console.log }) {
  const subject = exec('git', ['log', '-1', '--format=%s']).trim();
  if (isReleaseSubject(subject)) {
    log(`The head commit is a release commit (${subject}): nothing to release.`);
    return 0;
  }

  const version = nextVersion(exec('git', ['tag', '--list']).split('\n'));
  const tag = `v${version}`;
  log(`Releasing ${tag}.`);
  stamp(root, PACKAGE, version);
  stamp(root, PLUGIN, version);
  if (!attempt(exec, 'pnpm', ['kit:build'], log)) return 1;

  const trailer = exec('node', ['.omni-loop/bin/omni.mjs', 'sign', 'trailer']).trim();
  const message = trailer ? `chore(release): ${tag}\n\n${trailer}` : `chore(release): ${tag}`;
  exec('git', ['add', '--', PACKAGE, PLUGIN, BUNDLE]);
  exec('git', ['commit', '-q', '-m', message]);

  if (!attempt(exec, 'git', ['push', REMOTE, `HEAD:${BRANCH}`], log)) {
    log(`${BRANCH} moved while ${tag} was cut: rebasing onto it once.`);
    exec('git', ['fetch', REMOTE, BRANCH]);
    if (!attempt(exec, 'git', ['rebase', `${REMOTE}/${BRANCH}`], log)) {
      attempt(exec, 'git', ['rebase', '--abort'], log);
      log(`${tag} did not apply on ${BRANCH}: nothing tagged. The next merge takes the next number.`);
      return 1;
    }
    if (!attempt(exec, 'pnpm', ['kit:build'], log)) return 1;
    if (exec('git', ['status', '--porcelain', '--', BUNDLE]).trim()) {
      exec('git', ['add', '--', BUNDLE]);
      exec('git', ['commit', '-q', '--amend', '--no-edit']);
    }
    if (!attempt(exec, 'git', ['push', REMOTE, `HEAD:${BRANCH}`], log)) {
      log(`The push of ${tag} was rejected twice: nothing tagged. The next merge takes the next number.`);
      return 1;
    }
  }

  exec('git', ['tag', '-a', tag, '-m', tag]);
  exec('git', ['push', REMOTE, tag]);
  exec('gh', ['release', 'create', tag, BUNDLE, '--title', tag, '--generate-notes', '--verify-tag']);
  log(`Released ${tag}.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const exec = (cmd, args) =>
    execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    process.exitCode = release({ root, exec });
  } catch (error) {
    console.error(String(error.stderr || error.message).trim());
    process.exitCode = 1;
  }
}
