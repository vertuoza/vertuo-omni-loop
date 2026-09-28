// `omni version` (and `omni --version`) — which kit runs, and whether a newer release exists
// (PRD 347). It runs without a context, like `help`: it needs no config. The running kit is
// `runningKit()` unless a caller injects `kit` ({ home, version, source }). Always exit 0, or 2 for
// a usage error: a GitHub that does not answer only drops the second line.
import { runningKit } from '../../lib/init/bundle.mjs';
import { latestRelease, versionLines } from '../../lib/version/version.mjs';
import { parseArgs, println, usageError } from '../args.mjs';

export const version = {
  withoutContext: true,
  async run(args, { stdout, exec, kit }) {
    const { positional } = parseArgs('version', args);
    if (positional.length) throw usageError('usage: omni version');
    const running = kit ?? runningKit({ exec });
    const latest = running.version ? latestRelease({ home: running.home, exec }) : null;
    for (const line of versionLines({ ...running, latest })) println(stdout, line);
    return 0;
  },
};
