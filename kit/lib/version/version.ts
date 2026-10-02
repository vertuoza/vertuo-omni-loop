// Which kit runs, and whether a newer one exists (PRD 347). The running version comes from the
// bundle's marker, or from the kit's package.json when running from source (lib/init/bundle.mjs);
// the latest is the kit home's latest GitHub Release, asked through `gh` within `timeoutMs`. Any
// failure to ask (no `gh`, no sign-in, no release, a timeout, an answer that is no version) is
// `null`: `omni version` then prints its first line alone.
import type { ExecText } from '../context.ts';
import { textOf } from '../narrow.ts';

/** The versions a release carries: `x.y.z`, with or without a leading `v`. */
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** `x.y.z` without its `v`, or `null` when `text` is no version. */
export function parseVersion(text: unknown): string | null {
  const match = VERSION.exec(textOf(text).trim());
  return match ? `${match[1]}.${match[2]}.${match[3]}` : null;
}

/** Negative when `a` is older than `b`, zero when equal, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    // A part missing from either side reads as NaN, exactly as indexing past the end always did.
    const x = pa[i] ?? Number.NaN;
    const y = pb[i] ?? Number.NaN;
    if (x !== y) return x - y;
  }
  return 0;
}

/** The latest release of `home` (`owner/name`) as `x.y.z`, or `null` when GitHub does not say. */
export function latestRelease({ home, exec, timeoutMs = 5000 }: { home: string | null | undefined; exec: ExecText; timeoutMs?: number }): string | null {
  if (!home) return null;
  try {
    const out = exec('gh', ['release', 'view', '--repo', home, '--json', 'tagName', '--jq', '.tagName'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: timeoutMs,
    });
    return parseVersion(out);
  } catch {
    return null;
  }
}

/** The lines `omni version` prints, for the running `version` (or `null`) and the `latest` (or `null`). */
export function versionLines({ version, source, latest }: { version: string | null; source?: boolean; latest: string | null }): string[] {
  const first = `omni ${version ? `v${version}` : '(unversioned)'}${source ? ' (source)' : ''}`;
  if (!version || !latest) return [first];
  const order = compareVersions(version, latest);
  if (order === 0) return [`${first} (latest)`];
  if (order < 0) return [first, `latest v${latest}, run: omni update`];
  return [first];
}
