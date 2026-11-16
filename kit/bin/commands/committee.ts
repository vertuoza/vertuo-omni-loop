// `omni committee check <prd> --approve [--author <role>] [--json]` — PRD 2896 s9: what the fleet's committee reads before
// any member runs. The PRD's files as this checkout holds them (spec, plan, before/after, voice), each with its hash; the
// members who sit (the PM chairing, the Architect, the Reviewer, but the hero `--author` names, whose job wrote the PRD),
// each with its role's agent and model; and each line of the escalation list that applies (kit/lib/committee/escalation.ts):
// a PRD whose spec does not say `phase0: server`, one that names a locked law or a Legal entry, a migration of its branch
// that drops or rewrites data. A business law judged red is read by the App when it records the decision.
//
// `omni committee check <prd> --item <id> [--bound <0-1>] [--author <role>] [--json]` — PRD 2896 s10: the same for a high
// outbox item of the PRD, open in this checkout: the item file by its hash, and the list read from it (a human-action item,
// a locked law, a Legal entry or a business law it bears on, a hard-to-revert score unknown or at or above `--bound`, the
// mission's `mandate.hardToRevert`, 0.6 when it is not given, a migration of its branch that drops or rewrites data).
//
// `omni committee record <prd> --approve|--item <id> --file <votes.json> [--bound <0-1>] [--author <role>]` — the same facts
// read again, the members' verdicts checked (kit/lib/committee/vote.ts), the decision taken (escalated by rule first, by
// vote second) and printed: one line of what it came to, one per reason, then the record line the App reads back from the
// job's log (kit/lib/committee/record.ts); an answer's names the item and option A, what was built. A votes file it refuses
// prints why on stderr, exit 1, and no record.
//
// Neither touches the network: the App records the decision, as the service, from the job's log (BR-PRODUCT-94), and settles
// a carried answer in the PRD's ledger itself.
import type { Context } from '../../lib/context.ts';
import { bearsOn, decide, escalations, itemFacts, rewritesData, type CommitteeFacts } from '../../lib/committee/escalation.ts';
import { committeeLine, type CommitteeRecord } from '../../lib/committee/record.ts';
import { CommitteeRoleSchema, parseVotes, sitting, type CommitteeRole } from '../../lib/committee/vote.ts';
import { readDossierFolder, sha256 } from '../../lib/dossier/folder.ts';
import { readRepoFile } from '../../lib/check-report.ts';
import { parseOutboxItemId, type PrdNumber } from '../../lib/ids.ts';
import { lockedLaws } from '../../lib/laws.ts';
import { openItems } from '../../lib/outbox/status.ts';
import { parseItem } from '../../lib/outbox/settle.ts';
import { roleOf } from '../../lib/virtual-fleet/roles.ts';
import { parseArgs, prdArg, println, readUserFile, usageError } from '../args.ts';
import type { Command, CommandIo, Exec } from '../io.ts';
import { synchronous } from '../synchronous.ts';

const USAGE =
  'usage: omni committee check <prd> --approve|--item <id> [--bound <0-1>] [--author <role>] [--json]\n' +
  '       omni committee record <prd> --approve|--item <id> --file <votes.json> [--bound <0-1>] [--author <role>]';

const FLAGS = { values: ['author', 'file', 'item', 'bound'] as const, booleans: ['approve', 'json'] as const };

/** `mandate.hardToRevert`'s default (kit/lib/mission/brief.ts): the bound an item's score is read against when none is given. */
const DEFAULT_BOUND = 0.6;

/** The option the committee answers an item with: what was built. */
const BUILT = 'A';

/** One file the committee reads: its kind, its path and its hash. */
type ReadFile = { kind: string; path: string; sha256: string };

/** What the committee reads of PRD `prd`: its files, the list's facts, who sits, and the item it answers (null for an approval). */
type Read = { prd: PrdNumber; files: ReadFile[]; facts: CommitteeFacts; author: CommitteeRole | null; item: string | null };

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

/** The migrations of the checkout's branch that drop or rewrite data. */
const dataMigrations = (ctx: Context, exec: Exec): string[] => branchMigrations(ctx, exec).filter(({ sql }) => rewritesData(sql)).map(({ path }) => path);

/** The hero `--author` names; null when none; a usage error for a role off the committee. */
function authorOf(flag: string | undefined): CommitteeRole | null {
  if (flag === undefined) return null;
  const author = CommitteeRoleSchema.safeParse(flag);
  if (!author.success) throw usageError(`omni committee: --author is pm, architect or reviewer, not ${flag}.`);
  return author.data;
}

/** The mission's `mandate.hardToRevert` `--bound` gives, 0 to 1; its default when it is not given. */
function boundOf(flag: string | undefined): number {
  if (flag === undefined) return DEFAULT_BOUND;
  const bound = Number(flag);
  if (flag.trim() === '' || !(bound >= 0 && bound <= 1)) throw usageError(`omni committee: --bound is a number from 0 to 1, not ${flag}.`);
  return bound;
}

/** What the committee reads before any member runs; a usage error when the arguments do not read, or what it reads is not here. */
function readFacts(args: string[], { ctx, exec }: CommandIo): Read & { json: boolean; file: string | undefined } {
  const { positional, flags } = parseArgs('committee', args, FLAGS);
  if (positional.length !== 1 || (flags.approve === true) === (flags.item !== undefined)) throw usageError(USAGE);
  const prd = prdArg('committee', '<prd>', positional[0]);
  const author = authorOf(flags.author);
  const read = flags.item === undefined ? approvalOf(prd, ctx, exec) : answerOf(prd, flags.item, boundOf(flags.bound), ctx, exec);
  return { ...read, author, json: flags.json === true, file: flags.file };
}

/** An approval's files and facts: the PRD's folder, its locked laws and Legal entries, its phase 0, its branch's migrations. */
function approvalOf(prd: PrdNumber, ctx: Context, exec: Exec): Omit<Read, 'author'> {
  const folder = readDossierFolder(ctx, prd);
  if (!folder) throw usageError(`omni committee: PRD ${String(prd)} has no inbox or shipped folder in this checkout: read it on its feature branch.`);
  const text = (kind: string): string => folder.artifacts.find((one) => one.kind === kind)?.content ?? '';
  const named = bearsOn(`${text('spec')}\n${text('plan')}`, lockedLaws(ctx).map((law) => law.id));
  const facts: CommitteeFacts = {
    kind: 'approve',
    phase0: PHASE0_SERVER.test(text('spec')) ? 'server' : 'pr',
    lockedLaws: named.lockedLaws,
    legal: named.legal,
    redBusinessLaws: [],
    dataMigrations: dataMigrations(ctx, exec),
  };
  return { prd, files: folder.artifacts.map(({ kind, path, sha256: hash }) => ({ kind, path, sha256: hash })), facts, item: null };
}

/** An answer's file and facts (PRD 2896 s10): the item open in this checkout, read for the list. */
function answerOf(prd: PrdNumber, item: string, bound: number, ctx: Context, exec: Exec): Omit<Read, 'author'> {
  const open = openItems(prd, { ctx }).find((one) => one.id === item);
  if (open === undefined) throw usageError(`omni committee: PRD ${String(prd)} has no open item ${item} in this checkout: read it on its feature branch.`);
  const text = readRepoFile(ctx, open.file);
  const parsed = parseItem(text, open.file);
  const rank = parsed.ok ? parsed.item.rank : 'unread';
  const facts = itemFacts({ text, rank, locked: lockedLaws(ctx).map((law) => law.id), bound, dataMigrations: dataMigrations(ctx, exec) });
  return { prd, files: [{ kind: 'item', path: open.file, sha256: sha256(text) }], facts, item };
}

/** `omni committee check`: the files, who sits, and what the list escalates. */
function check(args: string[], io: CommandIo): number {
  const { prd, files, facts, author, json, item } = readFacts(args, io);
  const why = escalations(facts);
  const seats = sitting(author).map((role) => ({ role, agent: roleOf(role).agent, model: roleOf(role).model }));
  if (json) {
    println(io.stdout, JSON.stringify({ prd, ...(item === null ? {} : { item }), read: files, sitting: seats, author, escalations: why }));
    return 0;
  }
  println(io.stdout, `PRD ${String(prd)} · ${item === null ? "the committee's approval" : `the committee's answer to ${item}`}`);
  println(io.stdout, `read: ${files.map(({ kind, sha256: hash }) => `${kind} ${hash.slice(0, 7)}`).join(' · ')}`);
  println(io.stdout, `sits: ${seats.map(({ role, agent, model }) => `${role} (${agent} ${model})`).join(', ')}${author === null ? '' : ` · the ${author} sits out: its job ${item === null ? 'wrote it' : 'raised it'}`}`);
  if (why.length === 0) println(io.stdout, 'escalates: nothing by rule: the members vote');
  for (const line of why) println(io.stdout, `escalates: ${line}`);
  return 0;
}

/** What a carried decision comes to, in words. */
const carriedWords = (item: string | null): string =>
  item === null ? 'carried: the fleet approves it once the App records it' : `carried: the fleet answers ${item} with option ${BUILT} once the App records it`;

/** `omni committee record`: the decision on the votes in `--file`, then its record line, last. */
function record(args: string[], io: CommandIo): number {
  const { prd, files, facts, author, file, item } = readFacts(args, io);
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
  const common = {
    v: 1 as const,
    prd,
    author,
    read: files.map(({ kind, sha256: hash }) => ({ kind, sha256: hash })),
    escalations: escalations(facts),
    verdicts: decided.verdicts,
    outcome: decided.outcome,
  };
  const line: CommitteeRecord = item === null ? { ...common, kind: 'approve' } : { ...common, kind: 'answer', item: parseOutboxItemId(item), option: BUILT };
  println(io.stdout, `omni committee: PRD ${String(prd)} ${decided.outcome === 'carried' ? carriedWords(item) : 'escalated: it goes to a person'}`);
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
