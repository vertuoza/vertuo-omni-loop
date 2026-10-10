// `omni harvest <prd> --pr <n>` — the knowledge harvest, run locally: the same pipeline the app runs
// on a merged feature pull request. The merge's facts and changed files (PRD 1171) come through `gh`,
// the model through the kit's OpenRouter client with the key from the environment, and the files go
// into the working tree: nothing is staged, nothing committed. Exit 0 when it wrote; 1 when refused
// (the pull request is not merged, or not into the default branch), naming why; 2 on a usage error or
// with no OPENROUTER_API_KEY, with nothing written.
//
// Worth a law? (PRD 1342) Each rule or invariant no changed test proves is asked of `omni decide
// law-worth`, its state the statement, its why, its principle, its domain and the PRD's title, `--old`
// the classifier's `worthALaw`; when it prints `unset` the classifier's answer counts. A "no" stays in
// the ledger, `not worth a law`. A "yes" has its law issue opened through `gh` first (`Law: <statement>`,
// labelled `labels.law`, signed), then is written `Enforced by: pending #<that issue>`.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { frontMatterTitle } from '../../lib/dossier/folder.ts';
import { KEY_VAR } from '../../lib/openrouter.ts';
import {
  applyHarvestEdits,
  classifyCandidate,
  finishHarvest,
  lawQuestions,
  noEdits,
  prepareHarvest,
  withoutWorth,
  type LawQuestion,
} from '../../lib/knowledge/pipeline.ts';
import { footerLine } from '../../lib/signature.ts';
import { parseArgs, prArg, prdArg, println, usageError } from '../args.ts';
import { githubEnv, pullRequestFilesFor, pullRequestFor } from '../github.ts';
import { decide } from './decide.ts';
import type { Context } from '../../lib/context.ts';
import type { Command, CommandIo } from '../io.ts';
import type { LawIssue, LawWorth, Merge, Placed } from '../../lib/knowledge/write.ts';
import { IssueNumberSchema, type IssueNumber, type PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni harvest <prd> --pr <feature pull request>';

const today = () => new Date().toISOString().slice(0, 10);

function landedText(entry: Placed): string {
  const ids = entry.landedAs.join(', ');
  switch (entry.kind) {
    case 'stays-here':
      return entry.law ? entry.ledgerLine.replace(/^- [^:]+: /, '') : 'stays here';
    case 'covered':
      return `covered by ${ids}`;
    case 'adr':
      return `${ids} (new, ${entry.status})`;
    case 'rule':
    case 'invariant':
      return `${ids} (new, ${entry.proposed ? 'proposed' : 'confirmed'})`;
  }
}

/** A rule's or an invariant's proof: what `Enforced by:` says, then each proposed path dropped. */
function proofLines(entry: Placed): string[] {
  if (!entry.enforcedBy) return [];
  const pending = entry.law?.issue ? `pending #${entry.law.issue}` : null;
  const enforced = pending ?? (entry.enforcedBy.length > 0 ? entry.enforcedBy.join(', ') : 'unenforced');
  return [`      Enforced by: ${enforced}`, ...(entry.dropped ?? []).map((drop) => `      dropped ${drop.path} — ${drop.reason}`)];
}

/** The title of PRD `prd`: its spec's `title:`, else its first `# ` heading; `null` when neither reads. */
export function prdTitle(ctx: Context, prd: PrdNumber): string | null {
  const spec = ctx.layout.specPath(prd);
  if (spec === null) return null;
  try {
    const text = readFileSync(join(ctx.root, spec), 'utf8');
    return frontMatterTitle(text) ?? (/^# (.+)$/m.exec(text)?.[1]?.trim() || null);
  } catch {
    return null;
  }
}

const DecidedSchema = z.object({ answer: z.enum(['true', 'false']), confidence: z.number(), decidedBy: z.literal('jev') });

/**
 * Asks `omni decide law-worth` one question; Jev's answer when it counted, `null` when it printed
 * unset or anything else, and the classifier's answer counts. Never throws for a decision outcome.
 */
export async function askLawWorth(question: LawQuestion, { ctx, exec, env, vars, ref }: Pick<CommandIo, 'ctx' | 'exec' | 'env' | 'vars'> & { ref: string }): Promise<LawWorth | null> {
  const dir = mkdtempSync(join(tmpdir(), 'omni-law-worth-'));
  try {
    const file = join(dir, 'state.json');
    writeFileSync(file, JSON.stringify(question.state));
    const out: string[] = [];
    const quiet = { write: () => true };
    const args = ['law-worth', '--state-file', file, '--old', String(question.old), '--ref', ref, '--json'];
    await decide.run(args, { cwd: ctx.root, stdout: { write: (text: string) => out.push(text) }, stderr: quiet, exec, env, vars });
    const read = DecidedSchema.safeParse(JSON.parse(out.join('') || 'null'));
    return read.success ? { worth: read.data.answer === 'true', decidedBy: 'Jev', confidence: read.data.confidence } : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const OpenedSchema = z.looseObject({ number: IssueNumberSchema });

/** Opens one law issue through `gh`, labelled `labels.law` and signed; returns its number. */
export function openLawIssue(issue: LawIssue, { ctx, exec, env }: Pick<CommandIo, 'ctx' | 'exec' | 'env'>): IssueNumber {
  const footer = footerLine(ctx.config.signature);
  const body = footer ? `${issue.body}\n\n${footer}` : issue.body;
  const ghEnv = githubEnv(ctx, { exec, env });
  const input = JSON.stringify({ title: issue.title, body, labels: [ctx.config.labels.law] });
  const reply = exec('gh', ['api', `repos/${ctx.config.repo.slug}/issues`, '--method', 'POST', '--input', '-'], {
    encoding: 'utf8',
    input,
    ...(ghEnv ? { env: ghEnv } : {}),
  });
  return OpenedSchema.parse(JSON.parse(reply)).number;
}

function checkLine(name: string, violations: readonly string[]): string {
  return violations.length === 0 ? `omni check ${name} ✓` : `omni check ${name} ✗ (${violations.length})`;
}

export const harvest: Command = {
  async run(args: string[], { ctx, stdout, stderr, exec, env, vars }: CommandIo) {
    const { positional, flags } = parseArgs('harvest', args, { values: ['pr'] });
    if (positional.length !== 1 || flags.pr === undefined) throw usageError(USAGE);
    const prd = prdArg('harvest', '<prd>', positional[0]);
    const number = prArg('harvest', '--pr', flags.pr);
    if (!vars.openrouter) throw usageError(`omni harvest: ${KEY_VAR} is not set — the harvest asks a model where each decision belongs.`);
    if (ctx.layout.whereIs(prd) === null) throw usageError(`omni harvest: PRD ${prd} has no inbox or shipped folder.`);

    const pr = pullRequestFor(ctx, { number, exec, env });
    const defaultBranch = ctx.config.repo.defaultBranch;
    if (!pr.merged) {
      println(stderr, `omni harvest: pull request #${number} is not merged — only a merged feature pull request is harvested.`);
      return 1;
    }
    if (pr.base !== defaultBranch) {
      println(stderr, `omni harvest: pull request #${number} merged into ${pr.base}, not into ${defaultBranch} — only a feature pull request is harvested.`);
      return 1;
    }
    const merge: Merge = { by: pr.mergedBy ?? '', at: pr.mergedAt ?? '', pr: pr.number, ...(pr.url ? { url: pr.url } : {}) };

    const changed = pullRequestFilesFor(ctx, { number, exec, env });
    const prepared = prepareHarvest({ ctx, prd, merge, changed });
    if (!prepared.ok) {
      println(stderr, [`omni harvest — PRD ${prd}: cannot harvest:`, ...prepared.errors.map((e) => `  - ${e}`)].join('\n'));
      return 1;
    }

    const replies = [];
    for (const candidate of prepared.candidates) {
      replies.push(
        await classifyCandidate({ candidate, summary: prepared.summary, changed: prepared.changed, openrouter: vars.openrouter, fetch: globalThis.fetch }),
      );
    }
    // Worth a law? only where the laws are the knowledge (PRD 1342, acceptance 10).
    const classified = ctx.config.laws.source === 'knowledge' ? replies : withoutWorth(replies);
    const worth: Record<string, LawWorth | null> = {};
    for (const question of lawQuestions({ ctx, prepared, classified, prdTitle: prdTitle(ctx, prd) })) {
      worth[question.id] = await askLawWorth(question, { ctx, exec, env, vars, ref: `PRD ${prd} ${question.id}` });
    }
    const judged = classified.map((entry) => ({ ...entry, worth: worth[entry.id] ?? null }));
    const date = today();
    const first = finishHarvest({ ctx, prepared, classified: judged, merge, date });
    const opened = Object.fromEntries(first.lawIssues.map((issue) => [issue.id, openLawIssue(issue, { ctx, exec, env })]));
    const result = first.lawIssues.length === 0 ? first : finishHarvest({ ctx, prepared, classified: judged, merge, date, lawIssues: opened });
    applyHarvestEdits({ root: ctx.root, edits: result.edits });

    const lines = [`omni harvest — PRD ${prd}, pull request #${merge.pr} merged by @${merge.by} on ${merge.at.slice(0, 10)}${pr.mergeSha ? ` (${pr.mergeSha.slice(0, 7)})` : ''}:`];
    if (prepared.settled.length > 0) {
      const open = prepared.settled.filter((entry) => entry.from === 'open').length;
      const drift = prepared.settled.length - open;
      lines.push(`  settled at merge: ${open} open item(s), ${drift} drift(s) never reworked, adopted by @${merge.by} (merged over a red outbox)`);
    }
    for (const { from, to } of prepared.shipped) lines.push(`  shipped: ${from} → ${to}`);
    for (const path of result.edits.deletes) lines.push(`  deleted ${path}`);
    for (const { path } of result.edits.writes) lines.push(`  wrote ${path}`);
    for (const issue of first.lawIssues) lines.push(`  opened law issue #${opened[issue.id]}: ${issue.title}`);
    if (result.placed.length > 0) {
      lines.push('  placed:');
      for (const entry of result.placed) lines.push(`    ${entry.id} → ${landedText(entry)} — ${entry.reason}`, ...proofLines(entry));
    }
    if (result.notPlaced.length > 0) {
      lines.push('  not placed:');
      for (const entry of result.notPlaced) lines.push(`    ${entry.id} — ${entry.reason}`);
    }
    if (prepared.candidates.length === 0) lines.push('  nothing to harvest: every settled decision was written back already.');
    lines.push(`  checks: ${checkLine('knowledge', result.checks.knowledge)} · ${checkLine('outbox', result.checks.outbox)}`);
    for (const violation of [...result.checks.knowledge, ...result.checks.outbox]) lines.push(`    ${violation}`);
    lines.push(noEdits(result.edits) ? 'Nothing changed.' : 'Review the diff and commit it.');
    println(stdout, lines.join('\n'));
    return 0;
  },
};
