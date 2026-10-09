// `omni approval <n> [--json]` (PRD 1299, s4): reads PRD n's approval in force on the Omni page
// (`GET /api/dossiers/approval`), with the terminal's sign-in, and judges it against the files of the
// tree this checkout holds (`kit/lib/approval/approval.ts`): approved, pending, drifted, unreachable
// or refused, one line each (a drifted file per line). It exits 0 on approved and 1 on every other
// state, the line printed either way; with no Omni page set or no sign-in it holds the PRD as
// unreachable and says why on stderr. `--json` prints the state, who approved and when, whether they
// are a member today, the dossier's link, the pinned files, what drifted and the lines.
//
// `omni approval flag [--json]` (item s7-01) reads this repository's phase-0 flag on the Omni page
// instead: `phase 0: server` or `phase 0: pr`, exit 0; or, when it cannot be read,
// `phase 0: pr · the flag could not be read: <why>`, exit 1. `/omni:brainstorm` reads it at step 0.
//
// It runs before a context exists, like `decide`, so that a test can hand it `tokens` (the token
// store), `home` (where the real one lives), `fetch` and `callMs`; it loads the context itself.
import { readFlag } from '../../lib/approval/flag.ts';
import type { FlagReading } from '../../lib/approval/flag.ts';
import { approvalReader } from '../../lib/approval/prd-state.ts';
import type { ApprovalReading } from '../../lib/approval/approval.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { loadContext } from '../../lib/context.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';
import type { PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni approval <n> [--json] · omni approval flag [--json]';

/** The flag's line, as `omni approval flag` prints it. */
const flagLine = ({ flag, why }: FlagReading): string =>
  why === null ? `phase 0: ${flag}` : `phase 0: ${flag} · the flag could not be read: ${why}`;

/** What a test hands `omni approval` beyond `main()`'s own. */
type ApprovalOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };

/** The reading as `--json` prints it. */
function shown(prd: PrdNumber, reading: ApprovalReading) {
  const { approval } = reading;
  return {
    prd: Number(prd),
    state: reading.state,
    approver: approval?.approver.login ?? null,
    member: approval?.approver.member ?? null,
    at: approval?.approvedAt ?? null,
    url: reading.url,
    files: approval?.files ?? [],
    drift: reading.drift,
    lines: reading.lines,
  };
}

function report(stdout: Out, prd: PrdNumber, reading: ApprovalReading, json: boolean): void {
  println(stdout, json ? JSON.stringify(shown(prd, reading)) : reading.lines.join('\n'));
}

export const approval = {
  withoutContext: true,
  async run(args: string[], { cwd, stdout, stderr, exec, tokens, home, fetch = globalThis.fetch, callMs }: FreeIo & ApprovalOptions) {
    const { positional, flags } = parseArgs('approval', args, { booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const ctx = loadContext(cwd, { exec });
    const repo = ctx.config.repo.slug;
    if (!repo) throw usageError('omni approval: no repository slug — set repo.slug in the config.');
    if (positional[0] === 'flag') {
      const reading = await readFlag(ctx.config.ask.url, { repo, tokens, home, fetch, callMs });
      println(stdout, flags.json ? JSON.stringify(reading) : flagLine(reading));
      return reading.why === null ? 0 : 1;
    }
    const prd = prdArg('approval', '<n>', positional[0]);
    if (!ctx.layout.whereIs(prd)) {
      println(stderr, `omni approval: PRD ${Number(prd)} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}.`);
      return 1;
    }
    const reading = await approvalReader(ctx, { repo, tokens, home, fetch, callMs })(prd);
    if ('why' in reading) println(stderr, `omni approval: ${String(reading.why)}`);
    report(stdout, prd, reading, Boolean(flags.json));
    return reading.state === 'approved' ? 0 : 1;
  },
} satisfies FreeCommand;
