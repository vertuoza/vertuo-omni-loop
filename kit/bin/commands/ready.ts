// `omni ready <prd> [--json]` (PRD 2898, s3) — whether PRD <prd>'s feature pull request may be marked
// ready: five checks run on its latest commit, each `pass`, `fail`, `not finished` or `not judged`,
// ready only on five passes (`../../lib/ready/checks.ts`). It reads the facts itself through `gh`
// (`../../lib/ready/gh-facts.ts`): the head commit's check runs, the `acceptance` check run's report,
// the diff against the default branch, the plan, the spec and the outbox ledger at the head. It prints
// one line per check, then the verdict as the last line; exit 0 only on 5 of 5, exit 1 on anything
// else, a pull request it cannot find included. `--json` prints the same as one object. It writes
// nothing and merges nothing. Whether the PRD is in a mission is read from the Omni page (PRD 3194,
// `../../lib/mission/membership.ts`) and printed beside it as `gated`; it never changes the verdict: the
// gate that asks `omni ready` decides whom to ask. When the page cannot be read it prints
// `mission membership not read: <why>` and exits 1, never `in no mission`.
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { fillBranch } from '../../lib/board.ts';
import { dossierSwitch } from '../../lib/config.ts';
import { loadContext } from '../../lib/context.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { parseFolderName } from '../../lib/layout.ts';
import { missionsOfPrd } from '../../lib/mission/membership.ts';
import type { Membership } from '../../lib/mission/membership.ts';
import { readyVerdict } from '../../lib/ready/checks.ts';
import { findFeaturePr, readFacts } from '../../lib/ready/gh-facts.ts';
import type { FactsSource, FeaturePr, Gh } from '../../lib/ready/gh-facts.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import { githubEnv } from '../github.ts';
import type { CommandIo, FreeCommand, FreeIo } from '../io.ts';

/** What a test hands `omni ready` beyond `main()`'s own: the page's sign-in and fetch. */
type ReadyIo = FreeIo & { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch; callMs?: number | undefined };

const USAGE = 'usage: omni ready <prd> [--json]';

/** `gh`, run with the repository's token, returning its text. */
function ghOf({ ctx, exec, env }: Pick<CommandIo, 'ctx' | 'exec' | 'env'>): Gh {
  const ghEnv = githubEnv(ctx, { exec, env });
  return (args) => exec('gh', [...args], { encoding: 'utf8', ...(ghEnv ? { env: ghEnv } : {}) });
}

/** Where the facts are read from, or the one line that says why they cannot be. */
function sourceOf(io: CommandIo, prd: ReturnType<typeof prdArg>): { source: FactsSource; branch: string } | string {
  const { ctx } = io;
  const repo = ctx.config.repo.slug;
  if (!repo) return 'no repository slug — set repo.slug in the config';
  const place = ctx.layout.whereIs(prd);
  const outboxDir = ctx.layout.outboxDir(prd);
  if (!place || !outboxDir) return `PRD ${String(prd)} is in neither ${ctx.layout.dirs.inbox} nor ${ctx.layout.dirs.shipped}`;
  const topic = parseFolderName(place.name)?.topic ?? place.name;
  const { inbox, shipped } = ctx.layout.dirs;
  const source: FactsSource = {
    gh: ghOf(io),
    repo,
    defaultBranch: ctx.config.repo.defaultBranch,
    prd: { dir: place.dir, outboxDir },
    prdFolders: [`${inbox}/${place.name}/`, `${shipped}/${place.name}/`, `${outboxDir}/`],
    generated: (ctx.config.generated ?? []).map((entry) => entry.path),
    markers: ctx.markers,
    full: ctx.config.ready.full,
  };
  return { source, branch: fillBranch(ctx.config.branches.feature, { topic }) };
}

/** Which missions name the PRD, read from the Omni page, or why it could not be read. */
function membershipOf(io: CommandIo & ReadyIo, prd: ReturnType<typeof prdArg>): Promise<Membership> {
  const { ctx, tokens, home, fetch = globalThis.fetch, callMs } = io;
  const toggle = dossierSwitch(ctx.config);
  const repo = ctx.config.repo.slug;
  if (!toggle.on) return Promise.resolve({ ok: false, why: 'off' });
  if (!repo) return Promise.resolve({ ok: false, why: 'no repository slug — set repo.slug in the config' });
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  return client ? missionsOfPrd(client, repo, prd) : Promise.resolve({ ok: false, why: 'no sign-in (omni signin)' });
}

/** Whether the PRD is named by a mission the page holds, in one line. */
function gatedLine(io: CommandIo, missions: readonly number[]) {
  const scope = io.ctx.config.ready.checks;
  const inMission = missions.length > 0;
  const why = inMission ? `in mission ${missions.map((mission) => `#${String(mission)}`).join(', ')}` : 'in no mission';
  return { scope, inMission, why: `ready.checks is ${scope}, PRD ${why}` };
}

type Verdict = ReturnType<typeof readyVerdict>;

/** One line per check, then the verdict's headline. */
function lines(verdict: Verdict): string[] {
  return [...verdict.checks.map((check, index) => `${String(index + 1)} ${check.state} · ${check.title} — ${check.why}`), verdict.headline];
}

/** The verdict as one object, with the pull request it was read for. */
function report(prd: PrdNumber, pr: FeaturePr, gated: ReturnType<typeof gatedLine>, verdict: Verdict): string {
  return JSON.stringify({ prd, pr: { number: pr.number, head: pr.head, draft: pr.draft }, gated, ...verdict });
}

/** Prints that the PRD could not be judged, as `text`, or `{ state, why }` under `--json`; the exit code. */
function notJudged(io: CommandIo, prd: PrdNumber, json: boolean, why: string, text: string): number {
  println(io.stdout, json ? JSON.stringify({ prd, state: 'not judged', why }) : text);
  return 1;
}

export const ready = {
  withoutContext: true,
  async run(args: string[], free: ReadyIo): Promise<number> {
    const { positional, flags } = parseArgs('ready', args, { booleans: ['json'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = prdArg('ready', '<prd>', positional[0] ?? '');
    const io = { ...free, ctx: loadContext(free.cwd, { exec: free.exec }) };
    const where = sourceOf(io, prd);
    if (typeof where === 'string') {
      println(io.stderr, `omni ready: ${where}`);
      return 2;
    }
    const pr = findFeaturePr(where.source.gh, where.source.repo, where.branch);
    if (!pr.ok) return notJudged(io, prd, flags.json === true, pr.why, `not judged: ${pr.why}`);
    const membership = await membershipOf(io, prd);
    if (!membership.ok) {
      const why = `mission membership not read: ${membership.why}`;
      return notJudged(io, prd, flags.json === true, why, why);
    }
    const verdict = readyVerdict(readFacts(where.source, pr.value));
    const gated = gatedLine(io, membership.missions);
    if (flags.json) println(io.stdout, report(prd, pr.value, gated, verdict));
    else for (const line of [`PRD ${String(prd)} · pull request #${String(pr.value.number)} · ${pr.value.head.slice(0, 8)} · ${gated.why}`, ...lines(verdict)]) println(io.stdout, line);
    return verdict.ready ? 0 : 1;
  },
} satisfies FreeCommand;
