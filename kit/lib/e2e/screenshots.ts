// PRD 1274: whether the e2e framework kept a screenshot for a healed step, and if not, why. It does not:
// a recording (`<e2e.dir>/.e2e/cache/*.json`) holds actions only, and the artifacts folder
// (`<e2e.dir>/.e2e/artifacts`, never committed) holds at most one Playwright `trace.zip` per attempt, whose
// frames carry a timestamp and no test id or call index. So a healed step cannot be paired with pixels by
// test id and call index, and the answer is always a reason. Reads folder names only: no network, no
// browser, no model.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** One side of a healed step: no screenshot was kept, and why. */
export type Shot = { readonly kept: false; readonly reason: string };
export type Screenshots = { readonly before: Shot; readonly after: Shot };

/** True when a `trace.zip` sits anywhere under `folder`; a missing folder holds none. */
function holdsTrace(folder: string): boolean {
  let entries;
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some((entry) => (entry.isDirectory() ? holdsTrace(join(folder, entry.name)) : entry.name === 'trace.zip'));
}

const BEFORE = 'the merge-base keeps no artifacts: they are not committed, and a recording holds actions only';

/** The screenshots of a healed step: always none kept, with the reason read from the working tree's artifacts folder. */
export function screenshotsFor(root: string, dir: string): Screenshots {
  const traced = holdsTrace(join(root, dir, '.e2e', 'artifacts'));
  const after = traced
    ? 'the framework keeps one trace per attempt, not one screenshot per step: its frames carry no call index, so none pairs with this step'
    : "the framework kept no artifacts for this run: a recording holds actions only (the config's trace mode keeps a trace per attempt)";
  return { before: { kept: false, reason: BEFORE }, after: { kept: false, reason: after } };
}
