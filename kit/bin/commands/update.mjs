// `omni update [--to <version>]` — the pull request that brings a repository to a release of the kit
// (PRD 347). The running bin only finds the target (the latest release, or the one `--to` names),
// downloads its bundle and runs it as `update --apply [--from <running version>]`: only the new
// version's code knows its own config format, forms and labels (lib/update/apply.mjs). Up to date,
// or from the kit's source (no bin to replace), it writes nothing. It runs without a context: it
// checks `config.yml` itself, under the version it installs. The running kit is `runningKit()` and
// the bundle `runningBundle()` unless a caller injects `kit` and `bundle`.
// Exit 0 done, 1 stopped (with one line), 2 usage.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runningBundle, runningKit } from '../../lib/init/bundle.mjs';
import { findRoot } from '../../lib/init/repo.mjs';
import { applyUpdate } from '../../lib/update/apply.mjs';
import { UpdateError, downloadBundle, findTarget } from '../../lib/update/release.mjs';
import { parseVersion } from '../../lib/version/version.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni update [--to <version>]';

/** The running version brought to `target` by the target's own bundle: its exit code. */
function handOver({ cwd, running, target, exec }) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-update-'));
  try {
    const bundle = downloadBundle({ home: running.home, version: target, dir, exec });
    const from = running.version ? ['--from', running.version] : [];
    try {
      exec('node', [bundle, 'update', '--apply', ...from], { cwd, stdio: 'inherit' });
      return 0;
    } catch (error) {
      return Number.isInteger(error?.status) ? error.status : 1;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const update = {
  withoutContext: true,
  async run(args, { cwd, stdout, stderr, exec, kit, bundle }) {
    const { positional, flags } = parseArgs('update', args, { values: ['to', 'from'], booleans: ['apply'] });
    if (positional.length) throw usageError(USAGE);
    if (flags.to !== undefined && !parseVersion(flags.to)) throw usageError(`omni update: --to takes a version like v0.0.12, got "${flags.to}".`);
    if (flags.from !== undefined && !parseVersion(flags.from)) throw usageError(`omni update: --from takes a version like 0.0.12, got "${flags.from}".`);
    const running = kit ?? runningKit({ exec });
    const out = (line) => println(stdout, line);

    try {
      if (flags.apply) {
        const file = bundle === undefined ? runningBundle() : bundle;
        if (running.source || !file || !running.version) {
          throw usageError('omni update --apply: this omni runs from the kit source, or carries no version; only a release bundle applies an update.');
        }
        const root = findRoot(cwd, exec);
        return applyUpdate({ root, bundle: file, version: running.version, from: flags.from ? parseVersion(flags.from) : null, home: running.home, exec, println: out });
      }
      if (running.source) {
        out(`omni runs from the kit source${running.version ? ` (v${running.version})` : ''}: there is no bin to update here.`);
        return 0;
      }
      const target = findTarget({ home: running.home, to: flags.to ?? null, exec });
      if (running.version === target) {
        out(`omni v${target} is up to date.`);
        return 0;
      }
      return handOver({ cwd, running, target, exec });
    } catch (error) {
      if (!(error instanceof UpdateError)) throw error;
      stderr.write(`${error.message}\n`);
      return 1;
    }
  },
};
