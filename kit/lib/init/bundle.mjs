// Whether this `omni` is the bundle, and where the kit comes from. `kit/build.mjs` defines
// `__OMNI_BUNDLE__` at build time (`{ home, version }`): the bundle carries it, the kit source never does. Only the bundle
// may be installed as a repository's `.omni-loop/bin/omni.mjs`; a shim onto source never is.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slugFromRemote } from '../context.mjs';

/* global __OMNI_BUNDLE__ */
const MARKER = typeof __OMNI_BUNDLE__ === 'undefined' ? null : __OMNI_BUNDLE__;

/** The file of the running bundle, or `null` when running from the kit source. */
export function runningBundle() {
  return MARKER ? fileURLToPath(import.meta.url) : null;
}

/**
 * The `owner/name` of the repository the kit is fetched from: recorded in the bundle at build time,
 * read from the kit checkout's `origin` remote when running from source. `null` when neither knows.
 */
export function kitHome({ exec }) {
  if (MARKER) return MARKER.home ?? null;
  try {
    const kitDir = fileURLToPath(new URL('../..', import.meta.url));
    return slugFromRemote(exec('git', ['remote', 'get-url', 'origin'], { cwd: kitDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return null;
  }
}

/**
 * The running kit: its home, its version and whether it runs from source. The bundle's version is
 * the one its build read from package.json (`null` when there was none); from source, it is the
 * kit checkout's package.json `version`, read now.
 *
 * @returns {{ home: string | null, version: string | null, source: boolean }}
 */
export function runningKit({ exec }) {
  if (MARKER) return { home: MARKER.home ?? null, version: MARKER.version ?? null, source: false };
  let version = null;
  try {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'));
    version = typeof pkg.version === 'string' && pkg.version ? pkg.version : null;
  } catch {
    version = null;
  }
  return { home: kitHome({ exec }), version, source: true };
}

/** The one-line install, as a person types it. */
export function installCommand(home) {
  return `npx ${home ? `github:${home}` : 'github:<owner>/<kit repository>'} init`;
}
