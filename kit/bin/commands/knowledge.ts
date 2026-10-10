// `omni knowledge <id>` — one entry of the knowledge folder and every entry that serves it.
// Ported from vertuo-ai-domain@c4a210122:scripts/knowledge.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
//
// `omni knowledge judge` — the sweep (PRD 1342). Each rule and invariant whose `Enforced by:` is
// `unenforced` is asked "worth a law?": the model first (the classifier's answer), then `omni decide
// law-worth`, whose answer counts when Jev's does. A "yes" has its law issue opened through `gh`,
// then is written `Enforced by: pending #<n>`; a "no" leaves its register for its ledger. Once every
// one is judged, `laws.requireProof: true`. Writes into the working tree, stages and commits nothing.
// Exit 0 once it ran; 1 when `laws.source` is not `knowledge`; 2 on a usage error or with no
// OPENROUTER_API_KEY, with nothing written.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE } from '../../lib/config.ts';
import { parsePrd } from '../../lib/ids.ts';
import { describeEntry } from '../../lib/knowledge/describe.ts';
import {
  lawIssueOf,
  prdOf,
  sweepEdits,
  sweepState,
  unenforcedLaws,
  worthPrompt,
  WorthReplySchema,
  WORTH_JSON_SCHEMA,
  WORTH_SYSTEM,
  type SweepResult,
  type SweepVerdict,
} from '../../lib/knowledge/judge.ts';
import { readKnowledge, type KnowledgeEntry } from '../../lib/knowledge/registers.ts';
import { applyKnowledgeWrites, lawWorthNote, type LawWorth } from '../../lib/knowledge/write.ts';
import { askModel, KEY_VAR } from '../../lib/openrouter.ts';
import { parseArgs, println, usageError } from '../args.ts';
import { askLawWorth, openLawIssue, prdTitle } from './harvest.ts';
import type { Command, CommandIo } from '../io.ts';

const USAGE = 'usage: omni knowledge <id>   e.g. omni knowledge P-PRODUCT-1\n       omni knowledge judge';

function describe(id: string, { ctx, stdout, stderr }: Pick<CommandIo, 'ctx' | 'stdout' | 'stderr'>): number {
  const text = describeEntry(readKnowledge({ ctx }), id);
  if (text === null) {
    println(stderr, `omni knowledge: nothing in ${ctx.layout.knowledgeRoot}/ claims ${id}.`);
    return 1;
  }
  println(stdout, text);
  return 0;
}

/** A file's text under the checkout, `null` when it cannot be read. */
function readOrNull(root: string, path: string): string | null {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

/** Every Markdown file under the knowledge folder, from the repository's root. */
function knowledgeFiles(root: string, dir: string): string[] {
  try {
    return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('.md'))
      .map((path) => `${dir}/${path}`)
      .sort();
  } catch {
    return [];
  }
}

/** The classifier's answer to "worth a law?" for one law, or why there is none. */
async function classifierWorth(state: ReturnType<typeof sweepState>, vars: CommandIo['vars']): Promise<{ worth: boolean } | { reason: string }> {
  const answer = await askModel({
    system: WORTH_SYSTEM,
    user: worthPrompt(state),
    check: WorthReplySchema,
    schema: { name: 'law_worth', schema: WORTH_JSON_SCHEMA },
    openrouter: vars.openrouter,
    fetch: globalThis.fetch,
    title: 'omni knowledge judge',
  });
  const read = WorthReplySchema.safeParse(answer.reply);
  if (answer.ok && read.success) return { worth: read.data.worthALaw };
  return { reason: answer.reason ?? 'the model gave no answer' };
}

/** `worth a law (<decided by> <score>)` or `not worth a law (…)`. */
const worthText = (worth: LawWorth) => (worth.worth ? lawWorthNote(worth).replace(/^not /, '') : lawWorthNote(worth));

function requireProofLine(result: SweepResult, undecided: number): string {
  switch (result.requireProof) {
    case 'set':
      return `  laws.requireProof: true, set in ${CONFIG_FILE}`;
    case 'already':
      return '  laws.requireProof: true already';
    case 'undecided':
      return `  laws.requireProof stays false: ${undecided} law(s) not judged — run omni knowledge judge again`;
    case 'unreadable':
      return `  laws.requireProof: could not set it — add "requireProof: true" under laws: in ${CONFIG_FILE} yourself`;
  }
}

/** One law judged: its verdict and the issue line, or why it was not judged. */
type Judged = { verdict: SweepVerdict; opened: string | null } | { notJudged: string };

/** Asks one law "worth a law?" (the model, then Jev) and, on a "yes", opens its law issue. */
async function judgeLaw(entry: KnowledgeEntry, entries: readonly KnowledgeEntry[], { ctx, exec, env, vars }: CommandIo): Promise<Judged> {
  const prd = prdOf(entry.source);
  const state = sweepState(entry, entries, prd === null ? null : prdTitle(ctx, parsePrd(prd)));
  const classifier = await classifierWorth(state, vars);
  if ('reason' in classifier) return { notJudged: `not judged: ${classifier.reason}` };
  const jev = await askLawWorth({ id: entry.id, state, old: classifier.worth }, { ctx, exec, env, vars, ref: `sweep ${entry.id}` });
  const worth = jev ?? { worth: classifier.worth, decidedBy: 'classifier', confidence: null };
  if (!worth.worth) return { verdict: { worth, issue: null }, opened: null };
  const issue = lawIssueOf(entry);
  try {
    const number = openLawIssue(issue, { ctx, exec, env });
    return { verdict: { worth, issue: number }, opened: `  opened law issue #${number}: ${issue.title}` };
  } catch (error) {
    const why = error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
    return { notJudged: `not judged: its law issue could not be opened (${why})` };
  }
}

/** One law's line of the report. */
function lawLine(entry: KnowledgeEntry, judged: Judged | undefined, result: SweepResult): string {
  if (judged === undefined || 'notJudged' in judged) return `  ${entry.id} → ${judged?.notJudged ?? 'not judged'}`;
  const { worth, issue } = judged.verdict;
  if (issue !== null) return `  ${entry.id} → pending #${issue}, ${worthText(worth)}`;
  const removed = result.removed.find((gone) => gone.id === entry.id);
  return `  ${entry.id} → ${worthText(worth)}, recorded in ${removed?.ledger ?? 'no ledger: its source names no entry there'}`;
}

function report({ ctx, laws, judged, result }: { ctx: CommandIo['ctx']; laws: readonly KnowledgeEntry[]; judged: ReadonlyMap<string, Judged>; result: SweepResult }): string {
  const outcomes = [...judged.values()];
  const notJudged = outcomes.filter((one) => 'notJudged' in one).length;
  return [
    `omni knowledge judge — ${laws.length} unenforced law(s):`,
    ...laws.map((entry) => lawLine(entry, judged.get(entry.id), result)),
    ...outcomes.flatMap((one) => ('opened' in one && one.opened !== null ? [one.opened] : [])),
    ...result.citations.map(({ id, citedBy, file }) => `  ${id} is still cited by ${citedBy === null ? file : `${citedBy} (${file})`}`),
    ...result.writes.map(({ path }) => `  wrote ${path}`),
    requireProofLine(result, notJudged),
    result.writes.length === 0
      ? 'Nothing changed.'
      : `Review the diff, fix what still cites a removed entry, then open its knowledge PR from a branch shaped like ${ctx.config.branches.knowledge}.`,
  ].join('\n');
}

async function sweep(io: CommandIo): Promise<number> {
  const { ctx, stdout, stderr, vars } = io;
  if (ctx.config.laws.source !== 'knowledge') {
    println(stderr, `omni knowledge judge: laws.source is ${ctx.config.laws.source}, not knowledge — there are no laws in the knowledge base to judge.`);
    return 1;
  }
  if (!vars.openrouter) throw usageError(`omni knowledge judge: ${KEY_VAR} is not set — the sweep asks a model whether each law is worth one.`);

  const { entries } = readKnowledge({ ctx });
  const laws = unenforcedLaws(entries);
  const judged = new Map<string, Judged>();
  for (const entry of laws) judged.set(entry.id, await judgeLaw(entry, entries, io));
  const verdicts = Object.fromEntries([...judged].flatMap(([id, one]) => ('verdict' in one ? [[id, one.verdict]] : [])));

  const configText = readOrNull(ctx.root, CONFIG_FILE);
  const result = sweepEdits({
    entries,
    read: (path) => readOrNull(ctx.root, path),
    verdicts,
    markers: ctx.markers,
    knowledgeFiles: knowledgeFiles(ctx.root, ctx.layout.knowledgeRoot),
    config: configText === null ? null : { file: CONFIG_FILE, text: configText },
  });
  applyKnowledgeWrites({ ctx, writes: result.writes });
  println(stdout, report({ ctx, laws, judged, result }));
  return 0;
}

export const knowledge: Command = {
  async run(args: string[], io: CommandIo) {
    const { positional } = parseArgs('knowledge', args);
    if (positional.length !== 1) throw usageError(USAGE);
    const [verb = ''] = positional;
    return verb === 'judge' ? sweep(io) : describe(verb, io);
  },
};
