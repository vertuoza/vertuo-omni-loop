// Whether this `omni` is the bundle, and where the kit comes from. `kit/build.mjs` defines
// `__OMNI_BUNDLE__` at build time: the bundle carries it, the kit source never does. Only the bundle
// may be installed as a repository's `.omni-loop/bin/omni.mjs`; a shim onto source never is.
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

/** The one-line install, as a person types it. */
export function installCommand(home) {
  return `npx ${home ? `github:${home}` : 'github:<owner>/<kit repository>'} init`;
}
