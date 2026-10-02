// The version of the kit a repository runs (PRD 347, s4): the one its `.omni-loop/bin/omni.mjs`
// carries. It is the running omni's own when that bin is the one running; otherwise (the kit run
// through `npx`, say) it is read from the marker the bin's build wrote, and `null` for a bin
// installed before versions existed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseVersion } from '../version/version.ts';
import { BIN_FILE } from './apply.ts';

// How esbuild writes the marker `kit/build.ts` defines: `define_OMNI_BUNDLE_default = { home: …, version: "x.y.z" }`.
const STAMP = /define_OMNI_BUNDLE_default = \{[^}]*?\bversion: "([^"]+)"/;

/** The version a bundle's text carries, or `null` when it has none. */
export function bundleVersion(text: string): string | null {
  const match = STAMP.exec(text);
  return match ? parseVersion(match[1]) : null;
}

/**
 * The version the repository at `root` runs: `running.version` when its bin is byte for byte the
 * running `bundle`, else the one its bin carries, `null` for none or no bin.
 */
export function installedVersion({ root, running, bundle }: { root: string; running: { version: string | null }; bundle?: string | null }): string | null {
  const bin = join(root, BIN_FILE);
  if (!existsSync(bin)) return null;
  const text = readFileSync(bin);
  if (bundle && existsSync(bundle) && readFileSync(bundle).equals(text)) return running.version;
  return bundleVersion(text.toString('utf8'));
}
