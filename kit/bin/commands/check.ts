// `omni check [inbox|outbox|knowledge|kb|releases|coverage|all]` — the repository's guards. Each
// prints its violations (or its one pass line); exit 1 on any violation. `all` (the default) runs
// every guard, and skips `coverage` — never fails on it — when the default branch's remote ref is
// absent.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-inbox.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-outbox.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-registers.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-decision-coverage.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { formatFailure, formatPass, trackedFiles } from '../../lib/check-report.ts';
import { rangeChanges } from '../../lib/git.ts';
import { findInboxViolations } from '../../lib/inbox/check-inbox.ts';
import { gradeKnowledge } from '../../lib/knowledge/check-knowledge.ts';
import { COPIES_DIR, gradeCopies } from '../../lib/knowledge/copies.ts';
import { readKnowledge } from '../../lib/knowledge/registers.ts';
import { findOutboxViolations } from '../../lib/outbox/check-outbox.ts';
import {
  describeUnaccounted,
  discoveredPrds,
  findFormatViolations,
  gradePrd,
} from '../../lib/outbox/check-decision-coverage.ts';
import { riskyChanges } from '../../lib/outbox/decision-coverage.ts';
import { outboxItemFiles } from '../../lib/outbox/outbox.ts';
import { gradePlaybook } from '../../lib/playbook/check-playbook.ts';
import { findReleaseViolations, releaseNoteFiles } from '../../lib/releases/check-releases.ts';
import { parseArgs, positiveInt, println, usageError } from '../args.ts';
import type { Command, CommandIo } from '../io.ts';

const USAGE = 'usage: omni check [inbox|outbox|knowledge|kb|releases|coverage|all] [--base <ref>] [--prd <n>]';

/** Prints a guard's result; `true` when it is green. */
function report(stdout, title, violations, passLine) {
  if (violations.length > 0) {
    println(stdout, formatFailure(title, violations));
    return false;
  }
  println(stdout, formatPass(passLine));
  return true;
}

function checkInbox({ ctx, stdout }) {
  const violations = findInboxViolations({ ctx });
  const count = ctx.layout.specFiles().length;
  return report(
    stdout,
    'check inbox — an inbox file does not hold what it claims:',
    violations,
    `check inbox — ${count} inbox file(s), all well-formed.`,
  );
}

function checkOutbox({ ctx, stdout }) {
  const violations = findOutboxViolations({ ctx });
  const count = outboxItemFiles({ ctx }).length;
  return report(
    stdout,
    'check outbox — an outbox item does not hold what it claims:',
    violations,
    `check outbox — ${count} open item(s), all well-formed.`,
  );
}

function checkKnowledge({ ctx, stdout, stderr }) {
  const root = ctx.layout.knowledgeRoot;
  const title = 'check knowledge — the knowledge folder does not hold what it claims:';
  if (!existsSync(join(ctx.root, root))) {
    if (ctx.config.laws.source === 'knowledge') {
      return report(stdout, title, [`${root}: missing — laws.source is "knowledge", so the laws are read from here.`], '');
    }
    println(stdout, formatPass(`check knowledge — no knowledge folder at ${root}; nothing to grade (laws.source is "${ctx.config.laws.source}").`));
    return true;
  }
  // An imported copy's files cite its own ids, graded by `omni check kb` (PRD 522), never these.
  const files = trackedFiles(ctx, root).filter((file) => file.endsWith('.md') && !file.startsWith(`${root}/${COPIES_DIR}/`));
  const { violations, wishes, proposals } = gradeKnowledge({ ctx, files });
  for (const wish of wishes) println(stderr, `warning: ${wish}`);
  for (const proposal of proposals) println(stderr, `warning: ${proposal}`);
  const knowledge = readKnowledge({ ctx });
  const count = (kind) => knowledge.entries.filter((entry) => entry.kind === kind).length;
  return report(
    stdout,
    title,
    violations,
    `check knowledge — ${count('principle')} principle(s), ${count('rule')} rule(s), ${count('invariant')} invariant(s) ` +
      `across ${knowledge.domains.length} domain(s) and ${knowledge.crossDomainFiles.length} cross-domain file(s); ${wishes.length} wish(es), ${proposals.length} proposed.`,
  );
}

/** The states a pass line counts, in this order, each only when some form is in it. */
const FORM_STATES = ['filled', 'pointer', 'blank', 'missing'];

// PRD 522: in a plan repository, every imported copy's forms and registers too, each line prefixed
// by the copy's folder.
function checkKb({ ctx, stdout, stderr, exec }) {
  const own = gradePlaybook({ ctx, exec });
  const copies = gradeCopies({ ctx, exec });
  const violations = [...own.violations, ...copies.violations];
  const warnings = [...own.warnings, ...copies.warnings];
  for (const warning of warnings) println(stderr, `warning: ${warning}`);
  const { forms } = own;
  const counts = FORM_STATES.map((state) => [state, forms.filter((form) => form.state === state).length])
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${state}`);
  const copied = copies.copies === 0 ? '' : `; ${copies.copies} imported ${copies.copies === 1 ? 'copy' : 'copies'} checked`;
  return report(
    stdout,
    'check kb — a form does not hold what it claims:',
    violations,
    `check kb — ${forms.length} form(s): ${counts.join(', ')}; ${warnings.length} warning(s)${copied}.`,
  );
}

// PRD 262: every release note in the inbox and shipped folders, by the note's rules.
function checkReleases({ ctx, stdout }) {
  return report(
    stdout,
    'check releases — a release note does not hold what it claims:',
    findReleaseViolations({ ctx }),
    `check releases — ${releaseNoteFiles({ ctx }).length} release note(s), all well-formed.`,
  );
}

function defaultBase(ctx) {
  return `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
}

function refExists(ctx, ref, exec) {
  try {
    exec('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function checkCoverage({ ctx, stdout, exec }, { base, prd }) {
  let ok = report(
    stdout,
    'check coverage — an account file does not hold what it claims:',
    findFormatViolations({ ctx }),
    `check coverage — ${discoveredPrds({ ctx }).length} PRD outbox dir(s) checked, every account well-formed.`,
  );
  if (prd === null) return ok;

  const risky = riskyChanges(rangeChanges({ ctx, base, exec }), { ctx });
  const result = gradePrd(prd, risky, { ctx });
  for (const entry of result.stale) {
    println(
      stdout,
      `check coverage — PRD #${prd}: stale — ${entry.file}: \`${entry.path}\` (${entry.rule}) does not match this range; reported, not fatal.`,
    );
  }
  const violations = [...result.malformed, ...result.unaccounted.map((change) => describeUnaccounted(prd, change))];
  ok =
    report(
      stdout,
      `check coverage — PRD #${prd}, range ${base}...HEAD:`,
      violations,
      `check coverage — PRD #${prd}: ${risky.length} risky change(s) in range, ${result.accounted.length} accounted for.`,
    ) && ok;
  return ok;
}

const GUARDS = ['inbox', 'outbox', 'knowledge', 'kb', 'releases', 'coverage', 'all'];

export const check: Command = {
  async run(args: string[], io: CommandIo) {
    const { ctx, stdout, exec } = io;
    const { positional, flags } = parseArgs('check', args, { values: ['base', 'prd'] });
    if (positional.length > 1 || (positional[0] && !GUARDS.includes(positional[0]))) throw usageError(USAGE);
    const guard = positional[0] ?? 'all';
    const prd = flags.prd === undefined ? null : positiveInt('check', '--prd', flags.prd);
    const base = flags.base ?? defaultBase(ctx);
    const baseKnown = refExists(ctx, base, exec);
    // An explicit --base is the user's own ref: when it does not resolve, say so rather than skip.
    if (flags.base !== undefined && !baseKnown) {
      throw usageError(`omni check: no ${base} — fetch it or pass another --base <ref>.`);
    }
    const coverageRuns = guard === 'coverage' || (guard === 'all' && baseKnown);
    if (prd !== null && !coverageRuns) println(io.stderr, `omni check: --prd ${prd} ignored — the coverage guard did not run.`);

    if (guard === 'inbox') return checkInbox(io) ? 0 : 1;
    if (guard === 'outbox') return checkOutbox(io) ? 0 : 1;
    if (guard === 'knowledge') return checkKnowledge(io) ? 0 : 1;
    if (guard === 'kb') return checkKb(io) ? 0 : 1;
    if (guard === 'releases') return checkReleases(io) ? 0 : 1;
    if (guard === 'coverage') {
      if (!baseKnown) throw usageError(`omni check coverage: no ${base} — fetch it or pass --base <ref>.`);
      return checkCoverage(io, { base, prd }) ? 0 : 1;
    }

    const results = [checkInbox(io), checkOutbox(io), checkKnowledge(io), checkKb(io), checkReleases(io)];
    if (baseKnown) results.push(checkCoverage(io, { base, prd }));
    else println(stdout, `coverage: skipped — no ${base}`);
    return results.every(Boolean) ? 0 : 1;
  },
};
