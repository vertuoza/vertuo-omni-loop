// `omni committee check <prd> --approve [--author <role>] [--json]` — PRD 2896 s9: what the fleet's committee reads before
// any member runs. The PRD's files as this checkout holds them (spec, plan, before/after, voice), each with its hash; the
// members who sit (the PM chairing, the Architect, the Reviewer, but the hero `--author` names, whose job wrote the PRD),
// each with its role's agent and model; and each line of the escalation list that applies (kit/lib/committee/escalation.ts):
// a PRD whose spec does not say `phase0: server`, one that names a locked law or a Legal entry, a migration of its branch
// that drops or rewrites data. A business law judged red is read by the App when it records the decision.
//
// `omni committee record <prd> --approve --file <votes.json> [--author <role>]` — the same facts read again, the members'
// verdicts checked (kit/lib/committee/vote.ts), the decision taken (escalated by rule first, by vote second) and printed:
// one line of what it came to, one per reason, then the record line the App reads back from the job's log
// (kit/lib/committee/record.ts). A votes file it refuses prints why on stderr, exit 1, and no record.
//
// Neither touches the network: the App records the decision, as the service, from the job's log (BR-PRODUCT-94).
import type { Context } from '../../lib/context.ts';
import { bearsOn, decide, escalations, rewritesData, type ApprovalFacts } from '../../lib/committee/escalation.ts';
import { committeeLine, type CommitteeRecord } from '../../lib/committee/record.ts';
import { CommitteeRoleSchema, parseVotes, sitting, type CommitteeRole } from '../../lib/committee/vote.ts';
import { readDossierFolder, type Artifact } from '../../lib/dossier/folder.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { lockedLaws } from '../../lib/laws.ts';
import { roleOf } from '../../lib/virtual-fleet/roles.ts';
import { parseArgs, prdArg, println, readUserFile, usageError } from '../args.ts';
import type { Command, CommandIo, Exec } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE =
  'usage: omni committee check <prd> --approve [--author <role>] [--json]\n' +
  '       omni committee record <prd> --approve --file <votes.json> [--author <role>]';

const FLAGS = { values: ['author', 'file'] as const, booleans: ['approve', 'json'] as const };

/** What the committee reads of PRD `prd`: its files, the list's facts, and who sits. */
type Read = { prd: PrdNumber; files: Artifact[]; facts: ApprovalFacts; author: CommitteeRole | null };

const PHASE0_SERVER = /^---\r?\n[\s\S]*?^phase0:[ \t]*["']?server["']?[ \t]*\r?$[\s\S]*?^---/m;

/** The SQL files the checkout's branch adds or changes against the default branch, each with its text; none when git cannot say. */
function branchMigrations(ctx: Context, exec: Exec): { path: string; sql: string }[] {
  const base = `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
  let names: string;
  try {
    names = exec('git', ['-C', ctx.root, 'diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`], { encoding: 'utf8' });
  } catch {
    return [];
  }
  return names
    .split('\n')
    .map((line) => line.trim())
    .filter((path) => /(^|\/)migrations\/[^/]+\.sql$/.test(path))
    .flatMap((path) => {
      try {
        return [{ path, sql: exec('git', ['-C', ctx.root, 'show', `HEAD:${path}`], { encoding: 'utf8' }) }];
      } catch {
        return [];
      }
    });
}

/** The hero `--author` names; null when none; a usage error for a role off the committee. */
function authorOf(flag: string | undefined): CommitteeRole | null {
  if (flag === undefined) return null;
  const author = CommitteeRoleSchema.safeParse(flag);
  if (!author.success) throw usageError(`omni committee: --author is pm, architect or reviewer, not ${flag}.`);
  return author.data;
}

/** What the committee reads before any member runs; a usage error when the arguments do not read, or the PRD has no folder here. */
function readFacts(args: string[], { ctx, exec }: CommandIo): Read & { json: boolean; file: string | undefined } {
  const { positional, flags } = parseArgs('committee', args, FLAGS);
  if (positional.length !== 1 || flags.approve !== true) throw usageError(USAGE);
  const prd = prdArg('committee', '<prd>', positional[0]);
  const author = authorOf(flags.author);
  const folder = readDossierFolder(ctx, prd);
  if (!folder) throw usageError(`omni committee: PRD ${String(prd)} has no inbox or shipped folder in this checkout: read it on its feature branch.`);
  return { prd, files: folder.artifacts, facts: factsOf(folder.artifacts, ctx, exec), author, json: flags.json === true, file: flags.file };
}

/** The escalation list's facts, read from the PRD's files, the repository's locked laws and its branch's migrations. */
function factsOf(files: readonly Artifact[], ctx: Context, exec: Exec): ApprovalFacts {
  const text = (kind: string): string => files.find((one) => one.kind === kind)?.content ?? '';
  const named = bearsOn(`${text('spec')}\n${text('plan')}`, lockedLaws(ctx).map((law) => law.id));
  return {
    kind: 'approve',
    phase0: PHASE0_SERVER.test(text('spec')) ? 'server' : 'pr',
    lockedLaws: named.lockedLaws,
    legal: named.legal,
    redBusinessLaws: [],
    dataMigrations: branchMigrations(ctx, exec).filter(({ sql }) => rewritesData(sql)).map(({ path }) => path),
  };
}

/** `omni committee check`: the files, who sits, and what the list escalates. */
function check(args: string[], io: CommandIo): number {
  const { prd, files, facts, author, json } = readFacts(args, io);
  const why = escalations(facts);
  const seats = sitting(author).map((role) => ({ role, agent: roleOf(role).agent, model: roleOf(role).model }));
  if (json) {
    println(io.stdout, JSON.stringify({ prd, read: files.map(({ kind, path, sha256 }) => ({ kind, path, sha256 })), sitting: seats, author, escalations: why }));
    return 0;
  }
  println(io.stdout, `PRD ${String(prd)} · the committee's approval`);
  println(io.stdout, `read: ${files.map(({ kind, sha256 }) => `${kind} ${sha256.slice(0, 7)}`).join(' · ')}`);
  println(io.stdout, `sits: ${seats.map(({ role, agent, model }) => `${role} (${agent} ${model})`).join(', ')}${author === null ? '' : ` · the ${author} sits out: its job wrote it`}`);
  if (why.length === 0) println(io.stdout, 'escalates: nothing by rule: the members vote');
  for (const line of why) println(io.stdout, `escalates: ${line}`);
  return 0;
}

/** `omni committee record`: the decision on the votes in `--file`, then its record line, last. */
function record(args: string[], io: CommandIo): number {
  const { prd, files, facts, author, file } = readFacts(args, io);
  if (file === undefined) throw usageError(USAGE);
  let input: unknown;
  try {
    input = JSON.parse(readUserFile('committee', io.ctx, file));
  } catch {
    println(io.stderr, `omni committee: ${file} is not JSON, nothing recorded.`);
    return 1;
  }
  const votes = parseVotes(input);
  if (!votes.ok) {
    println(io.stderr, 'omni committee: the votes are refused, nothing recorded:');
    for (const error of votes.errors) println(io.stderr, `  ${error}`);
    return 1;
  }
  const decided = decide(facts, votes.verdicts, author);
  const line: CommitteeRecord = {
    v: 1,
    prd,
    kind: 'approve',
    author,
    read: files.map(({ kind, sha256 }) => ({ kind, sha256 })),
    escalations: escalations(facts),
    verdicts: decided.verdicts,
    outcome: decided.outcome,
  };
  println(io.stdout, `omni committee: PRD ${String(prd)} ${decided.outcome === 'carried' ? 'carried: the fleet approves it once the App records it' : 'escalated: it goes to a person'}`);
  for (const why of decided.why) println(io.stdout, `  ${why}`);
  println(io.stdout, committeeLine(line));
  return 0;
}

export const committee: Command = {
  run: synchronous((args: string[], io: CommandIo): number => {
    const [which = '', ...rest] = args;
    if (which === 'check') return check(rest, io);
    if (which === 'record') return record(rest, io);
    throw usageError(USAGE);
  }),
};
