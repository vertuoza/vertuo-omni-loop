// Where `omni update` finds the version it brings a repository to (PRD 347): the latest release of
// the kit's home, or the tag `--to` names, asked through `gh`; and the release's bundle, downloaded
// into a folder. Everything that fails here fails before the repository is written to.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { join } from 'node:path';
import type { ExecText } from '../context.ts';
import { parseVersion } from '../version/version.ts';

/** The asset every release carries: the bundle `kit/dist/omni.mjs`. */
export const BUNDLE_ASSET = 'omni.mjs';

const QUIET: ExecFileSyncOptionsWithStringEncoding = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

export class UpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpdateError';
  }
}

/**
 * The version (`x.y.z`) `omni update` targets: the release `to` names (`x.y.z`, with or without its
 * `v`), else the latest release of `home`. Throws UpdateError when GitHub does not know it, or cannot
 * be asked.
 */
export function findTarget({ home, to = null, exec, timeoutMs = 15000 }: { home: string | null; to?: string | null; exec: ExecText; timeoutMs?: number }): string {
  if (!home) throw new UpdateError('omni update: this omni does not know where the kit comes from, so it cannot find a release.');
  const tag = to === null ? null : `v${parseVersion(to)}`;
  const what = tag ? `the release ${tag} of ${home}` : `the latest release of ${home}`;
  let answer: string;
  try {
    answer = exec('gh', ['release', 'view', ...(tag ? [tag] : []), '--repo', home, '--json', 'tagName', '--jq', '.tagName'], { ...QUIET, timeout: timeoutMs });
  } catch {
    throw new UpdateError(`omni update: cannot find ${what}: ${tag ? 'no such tag, or ' : ''}GitHub is out of reach or gh is not signed in.`);
  }
  const version = parseVersion(answer);
  if (!version) throw new UpdateError(`omni update: ${what} is not a version: ${String(answer).trim() || '(nothing)'}.`);
  return version;
}

/** Downloads the bundle of release `v<version>` of `home` into `dir`: its path. */
export function downloadBundle({ home, version, dir, exec }: { home: string; version: string; dir: string; exec: ExecText }): string {
  try {
    exec('gh', ['release', 'download', `v${version}`, '--repo', home, '--pattern', BUNDLE_ASSET, '--dir', dir], QUIET);
  } catch {
    throw new UpdateError(`omni update: cannot download ${BUNDLE_ASSET} from the release v${version} of ${home}.`);
  }
  return join(dir, BUNDLE_ASSET);
}
