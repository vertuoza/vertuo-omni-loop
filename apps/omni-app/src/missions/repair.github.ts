// The kit a mission's repository pins (PRD 3088 s5, spec section 6): the version its `.omni-loop/bin/omni.mjs` carries on the mission
// branch (else the default branch), the one a runner compares its plugin with (kit/lib/runner/plugin.ts). Read through
// `octokitFor(installation)`, only while a PRD of the mission waits on an Omni Loop bug that was fixed. Read only.
//
//   a bundle   the version its build stamped in it (the stamp kit/lib/update/installed.ts reads), near its start: only its first
//              bytes are asked for
//   a shim     a repository that runs the kit's own source (the Omni Loop repository, its bin importing kit/bin/omni.ts) carries
//              no stamp: its version is its root package.json's, as the running kit reads it (kit/lib/init/bundle.ts › runningKit)
//   none       no bin, any other bin with no stamp, or a read GitHub refused: null, which reads older than any fix
import { z } from 'zod';
import { parseVersion } from 'omni-loop/kit/lib/version/version.ts';
import { statusOf, type GitHubClient } from '../outbox-check/github-schema.ts';

/** The repository whose kit is read, as installation `installation`, on `ref` (null: its default branch). */
export type KitAt = { installation: number; repo: string; ref: string | null };

/** The kit a mission's repository pins: `0.0.N`, or null when it does not read. */
export type MissionKits = { pinned: (at: KitAt) => Promise<string | null> };

/**
 * The stamp `kit/build.ts` writes in a bundle, as kit/lib/update/installed.ts reads it: not imported from there, which would bring the
 * kit's update steps (and the skills they copy) into the App's functions, where Vercel ships none of their files.
 */
const STAMP = /define_OMNI_BUNDLE_default = \{[^}]*?\bversion: "([^"]+)"/;

/** The version a bundle's text carries, or null when it has none. */
export const stampOf = (text: string): string | null => parseVersion(STAMP.exec(text)?.[1]);

/** The bin every kitted repository runs. */
export const BIN = '.omni-loop/bin/omni.mjs';

/** The bytes of the bin asked for: the stamp sits in its first few kilobytes. */
const HEAD_BYTES = 65_535;

const CONTENTS = 'GET /repos/{owner}/{repo}/contents/{path}';
const PackageSchema = z.looseObject({ version: z.unknown() });

/** `owner/name` as the contents API names it; a repository not shaped so throws, which reads null. */
function ownerAndName(full: string): { owner: string; repo: string } {
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(full);
  const owner = match?.[1];
  const repo = match?.[2];
  if (owner === undefined || repo === undefined) throw new Error(`the repository "${full}" is not owner/name`);
  return { owner, repo };
}

/** A file's raw text at `ref` (its first `bytes` when GitHub honours the range), null when it is absent. */
async function rawText(octokit: GitHubClient, { owner, repo, ref, path, bytes }: { owner: string; repo: string; ref: string | null; path: string; bytes?: number }): Promise<string | null> {
  try {
    const { data } = await octokit.request(CONTENTS, {
      owner,
      repo,
      path,
      ...(ref === null ? {} : { ref }),
      mediaType: { format: 'raw' },
      ...(bytes === undefined ? {} : { headers: { range: `bytes=0-${String(bytes)}` } }),
    });
    if (typeof data === 'string') return data;
    return data instanceof ArrayBuffer ? new TextDecoder().decode(data) : null;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

/**
 * Whether a bin is the kit's own shim onto its live source (the Omni Loop repository's): it imports `kit/bin/omni.ts`. Any other bin
 * with no stamp (one installed before versions existed) has no version: the repository's package.json is its own product's, never
 * the kit's.
 */
export const isShim = (bin: string): boolean => /['"]\.\.\/\.\.\/kit\/bin\/omni\.ts['"]/.test(bin);

/** The version a root package.json's text names, null when it names none. */
export function packageVersion(text: string | null): string | null {
  if (text === null) return null;
  try {
    const parsed = PackageSchema.safeParse(JSON.parse(text));
    return parsed.success ? parseVersion(parsed.data.version) : null;
  } catch {
    return null;
  }
}

/** The kit a mission's repository pins, through `octokitFor(installation)`: a refused read reads null, never a throw. */
export function missionKits({ octokitFor }: { octokitFor: (installation: number) => Promise<GitHubClient> | GitHubClient }): MissionKits {
  return {
    async pinned({ installation, repo, ref }) {
      try {
        const octokit = await octokitFor(installation);
        const at = { ...ownerAndName(repo), ref };
        const bin = await rawText(octokit, { ...at, path: BIN, bytes: HEAD_BYTES });
        if (bin === null) return null;
        const stamped = stampOf(bin);
        if (stamped !== null || !isShim(bin)) return stamped;
        return packageVersion(await rawText(octokit, { ...at, path: 'package.json' }));
      } catch {
        return null;
      }
    },
  };
}
