// Whether this `omni` is the bundle, and where the kit comes from. `kit/build.ts` defines
// `__OMNI_BUNDLE__` at build time (`{ home, version }`): the bundle carries it, the kit source never does. Only the bundle
// may be installed as a repository's `.omni-loop/bin/omni.mjs`; a shim onto source never is.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slugFromRemote } from '../context.ts';
import type { ExecText } from '../context.ts';
import { KitPackageSchema } from './schema.ts';

/** What the build records in the bundle: the kit's home and version, each `null` when it knew none. */
type BundleMarker = { home?: string | null; version?: string | null };

declare const __OMNI_BUNDLE__: BundleMarker | undefined;
const MARKER: BundleMarker | null = typeof __OMNI_BUNDLE__ === 'undefined' ? null : __OMNI_BUNDLE__;

/** The running kit, as `runningKit` describes it. */
export type RunningKit = { home: string | null; version: string | null; source: boolean };

/** The file of the running bundle, or `null` when running from the kit source. */
export function runningBundle(): string | null {
  return MARKER ? fileURLToPath(import.meta.url) : null;
}

/**
 * The `owner/name` of the repository the kit is fetched from: recorded in the bundle at build time,
 * read from the kit checkout's `origin` remote when running from source. `null` when neither knows.
 */
export function kitHome({ exec }: { exec: ExecText }): string | null {
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
 */
export function runningKit({ exec }: { exec: ExecText }): RunningKit {
  if (MARKER) return { home: MARKER.home ?? null, version: MARKER.version ?? null, source: false };
  let version: string | null = null;
  try {
    const text = readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8');
    version = KitPackageSchema.parse(JSON.parse(text)).version;
  } catch {
    version = null;
  }
  return { home: kitHome({ exec }), version, source: true };
}

/** The one-line install, as a person types it. */
export function installCommand(home: string | null): string {
  return `npx ${home ? `github:${home}` : 'github:<owner>/<kit repository>'} init`;
}
