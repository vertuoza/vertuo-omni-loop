// `omni harvest <prd> --pr <n>` — the knowledge harvest, run locally: the same pipeline the app runs
// on a merged feature pull request. The merge's facts come through `gh`, the model through the kit's
// OpenRouter client with the key from the environment, and the files go into the working tree:
// nothing is staged, nothing committed. Exit 0 when it wrote; 1 when refused (the pull request is not
// merged, or not into the default branch), naming why; 2 on a usage error or with no
// OPENROUTER_API_KEY, with nothing written.
import { KEY_VAR } from '../../lib/openrouter.ts';
import { applyHarvestEdits, classifyCandidate, finishHarvest, noEdits, prepareHarvest } from '../../lib/knowledge/pipeline.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';
import { pullRequestFor } from '../github.ts';
import type { Command, CommandIo } from '../io.ts';
import type { Merge, Placed } from '../../lib/knowledge/write.ts';

const USAGE = 'usage: omni harvest <prd> --pr <feature pull request>';

const today = () => new Date().toISOString().slice(0, 10);

function landedText(entry: Placed): string {
  if (entry.kind === 'stays-here') return 'stays here';
  if (entry.kind === 'covered') return `covered by ${entry.landedAs.join(', ')}`;
  const standing = entry.kind === 'adr' ? entry.status : entry.proposed ? 'proposed' : 'confirmed';
  return `${entry.landedAs.join(', ')} (new, ${standing})`;
}

function checkLine(name: string, violations: readonly string[]): string {
  return violations.length === 0 ? `omni check ${name} ✓` : `omni check ${name} ✗ (${violations.length})`;
}

export const harvest: Command = {
  async run(args: string[], { ctx, stdout, stderr, exec, env }: CommandIo) {
    const { positional, flags } = parseArgs('harvest', args, { values: ['pr'] });
    if (positional.length !== 1 || flags.pr === undefined) throw usageError(USAGE);
    const prd = positiveInt('harvest', '<prd>', positional[0]);
    const number = positiveInt('harvest', '--pr', flags.pr);
    if (!env[KEY_VAR]) throw usageError(`omni harvest: ${KEY_VAR} is not set — the harvest asks a model where each decision belongs.`);
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

    const prepared = prepareHarvest({ ctx, prd, merge });
    if (!prepared.ok) {
      println(stderr, [`omni harvest — PRD ${prd}: cannot harvest:`, ...prepared.errors.map((e) => `  - ${e}`)].join('\n'));
      return 1;
    }

    const classified = [];
    for (const candidate of prepared.candidates) {
      classified.push(await classifyCandidate({ candidate, summary: prepared.summary, env, fetch: globalThis.fetch }));
    }
    const result = finishHarvest({ ctx, prepared, classified, merge, date: today() });
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
    if (result.placed.length > 0) {
      lines.push('  placed:');
      for (const entry of result.placed) lines.push(`    ${entry.id} → ${landedText(entry)} — ${entry.reason}`);
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
