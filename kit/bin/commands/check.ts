// `omni check [config|inbox|outbox|knowledge|kb|releases|agents|design|coverage|context|all]` — the repository's guards.
// Each prints its violations (or its one pass line); exit 1 on any violation. `all` (the default) runs
// every guard, and skips `coverage` — never fails on it — when the default branch's remote ref is
// absent; `design` then grades the library without comparing its locks. `context` (PRD 1679) runs in
// `all` only while `budgets.context.enabled` is true. `agents` (PRD 1890) grades the skill copies for
// the non-Claude agents against their manifest.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-inbox.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-outbox.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-registers.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
// Ported from vertuo-ai-domain@c4a210122:scripts/check-decision-coverage.mjs (its CLI half) — changes in kit/porting/bin--commands.md.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { formatFailure, formatPass, trackedFiles } from '../../lib/check-report.ts';
import { baseKnowledge, rangeChanges } from '../../lib/git.ts';
import { findInboxViolations, inboxAvoidWarnings } from '../../lib/inbox/check-inbox.ts';
import { gradeKnowledge } from '../../lib/knowledge/check-knowledge.ts';
import { verifyServedLegal, type LegalReach } from '../../lib/knowledge/check-knowledge-legal.ts';
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
import { gradeAgents } from '../../lib/agents/check.ts';
import { CONFIG_FILE, ConfigError, contextBudget, designScreensDir } from '../../lib/config.ts';
import { prdOfBranch } from '../../lib/ask/context.ts';
import { currentBranch } from '../../lib/ask/title.ts';
import { parseCeilings, readCeilings } from '../../lib/budgets/ceilings.ts';
import type { Ceilings } from '../../lib/budgets/ceilings.ts';
import { measureContextBudget } from '../../lib/budgets/measure.ts';
import { budgetTable, neutralLines, redMessage } from '../../lib/budgets/message.ts';
import { targetGrowth } from '../../lib/budgets/message-growth.ts';
import { overall, ratchet, settledRaises } from '../../lib/budgets/ratchet.ts';
import type { Raise } from '../../lib/budgets/ratchet.ts';
import { messageOf } from '../../lib/narrow.ts';
import { outboxStore } from '../../lib/outbox/stores.ts';
import { gradeDesign, headSnapshot, snapshotAt } from '../../lib/design/check-design.ts';
import { DEFAULT_HOOK_MAX_BYTES, hookFileViolations } from '../../lib/flow/schema.ts';
import { generatedViolations, readGround } from '../../lib/generated/check.ts';
import { parseArgs, prdArg, println, usageError, type Flags } from '../args.ts';
import type { CommandIo, Exec, FreeCommand, FreeIo, Out } from '../io.ts';
import { loadContext, type Context } from '../../lib/context.ts';
import type { PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni check [config|inbox|outbox|knowledge|kb|releases|agents|design|coverage|context|all] [--base <ref>] [--prd <n>]';

/** Prints a guard's result; `true` when it is green. */
function report(stdout: Out, title: string, violations: readonly string[], passLine: string): boolean {
  if (violations.length > 0) {
    println(stdout, formatFailure(title, violations));
    return false;
  }
  println(stdout, formatPass(passLine));
  return true;
}

function checkInbox({ ctx, stdout }: CommandIo): boolean {
  const violations = findInboxViolations({ ctx });
  const count = ctx.layout.specFiles().length;
  // PRD 2299: the product's avoided words in a spec are warnings, never a violation.
  const green = report(
    stdout,
    'check inbox — an inbox file does not hold what it claims:',
    violations,
    `check inbox — ${count} inbox file(s), all well-formed.`,
  );
  for (const warning of inboxAvoidWarnings({ ctx })) println(stdout, warning);
  return green;
}

function checkOutbox({ ctx, stdout }: CommandIo): boolean {
  const violations = findOutboxViolations({ ctx });
  const count = outboxItemFiles({ ctx }).length;
  return report(
    stdout,
    'check outbox — an outbox item does not hold what it claims:',
    violations,
    `check outbox — ${count} open item(s), all well-formed.`,
  );
}

// PRD 1795: a rule that serves an `L-` id is verified against the product, never blocking on the network.
async function checkKnowledge({ ctx, stdout, stderr, exec }: CommandIo, { cwd, reach }: { cwd: string; reach: LegalReach }): Promise<boolean> {
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
  const legal = await verifyServedLegal({ ctx, entries: knowledge.entries, cwd, exec, reach });
  for (const note of legal.notes) println(stdout, note);
  const count = (kind: string) => knowledge.entries.filter((entry) => entry.kind === kind).length;
  return report(
    stdout,
    title,
    [...violations, ...legal.violations],
    `check knowledge — ${count('principle')} principle(s), ${count('rule')} rule(s), ${count('invariant')} invariant(s), ${count('contract')} contract(s) ` +
      `across ${knowledge.domains.length} domain(s) and ${knowledge.crossDomainFiles.length} cross-domain file(s); ${wishes.length} wish(es), ${proposals.length} proposed.`,
  );
}

/** The states a pass line counts, in this order, each only when some form is in it. */
const FORM_STATES = ['filled', 'pointer', 'blank', 'missing'];

// PRD 522: in a plan repository, every imported copy's forms and registers too, each line prefixed
// by the copy's folder.
function checkKb({ ctx, stdout, stderr, exec }: CommandIo): boolean {
  const own = gradePlaybook({ ctx, exec });
  const copies = gradeCopies({ ctx, exec });
  const violations = [...own.violations, ...copies.violations];
  const warnings = [...own.warnings, ...copies.warnings];
  for (const warning of warnings) println(stderr, `warning: ${warning}`);
  const { forms } = own;
  const counts = FORM_STATES.map((state): [string, number] => [state, forms.filter((form) => form.state === state).length])
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
function checkReleases({ ctx, stdout }: CommandIo): boolean {
  return report(
    stdout,
    'check releases — a release note does not hold what it claims:',
    findReleaseViolations({ ctx }),
    `check releases — ${releaseNoteFiles({ ctx }).length} release note(s), all well-formed.`,
  );
}

// PRD 1890: the copies `.agents/skills/omni-*` as the manifest says omni wrote them, and installed
// whenever `agents` lists an agent other than Claude.
function checkAgents({ ctx, stdout }: CommandIo): boolean {
  const grade = gradeAgents({ root: ctx.root, agents: ctx.config.agents });
  const pass = grade.installed
    ? `check agents — ${grade.folders} folder(s), ${grade.files} file(s), every copy as omni wrote it.`
    : 'check agents — agents lists claude alone; no copies to check.';
  return report(stdout, 'check agents — a skill copy does not hold what omni wrote:', grade.violations, pass);
}

function defaultBase(ctx: Context): string {
  return `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
}

function refExists(ctx: Context, ref: string, exec: Exec): boolean {
  try {
    exec('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function checkCoverage({ ctx, stdout, exec }: CommandIo, { base, prd }: { base: string; prd: PrdNumber | null }): boolean {
  let ok = report(
    stdout,
    'check coverage — an account file does not hold what it claims:',
    findFormatViolations({ ctx }),
    `check coverage — ${discoveredPrds({ ctx }).length} PRD outbox dir(s) checked, every account well-formed.`,
  );
  if (prd === null) return ok;

  const risky = riskyChanges(rangeChanges({ ctx, base, exec }), { ctx, base: baseKnowledge({ ctx, base, exec }) });
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

/** The pass line's word on the `generated` section (PRD 1138): nothing when the config has none. */
function generatedNote(entries: readonly unknown[] | undefined): string {
  return entries === undefined ? '' : `; generated: ${entries.length} output(s), every path, source and build present`;
}

// PRD 1089: the config itself, its flow included, and the hook files the flow names. PRD 1138: and
// every generated output's path, sources and build.
function checkConfig({ ctx, stdout }: CommandIo): boolean {
  const { flow, limits, generated } = ctx.config;
  const areas = Object.keys(flow?.areas ?? {}).length;
  const violations = [
    ...hookFileViolations(ctx.root, flow, limits.hookMaxBytes ?? DEFAULT_HOOK_MAX_BYTES),
    ...(generated === undefined ? [] : generatedViolations(generated, readGround(ctx.root))),
  ];
  return report(
    stdout,
    CONFIG_TITLE,
    violations,
    `check config — ${CONFIG_FILE} is valid; ${flow ? `flow: ${areas} area(s), every hook file present` : 'no flow'}${generatedNote(generated)}.`,
  );
}

const CONFIG_TITLE = 'check config — the config does not hold what it claims:';

// PRD 1407: the screen library and the design form's laws — a locked decision changes only with a
// dated amendment, graded against the base at its merge base with HEAD; off while `design.enabled` is.
function checkDesign({ ctx, stdout, stderr, exec }: CommandIo, { base, baseKnown }: Pick<Range, 'base' | 'baseKnown'>): boolean {
  if (!ctx.config.design.enabled) {
    println(stdout, formatPass('check design — design is off; nothing to check.'));
    return true;
  }
  const dir = designScreensDir(ctx.config);
  const formFile = ctx.layout.formPath('design') ?? '';
  const ref = baseKnown ? mergeBase(ctx, base, exec) : null;
  const grade = gradeDesign({
    dir,
    formFile,
    head: headSnapshot({ root: ctx.root, dir, formFile }),
    base: ref === null ? null : snapshotAt({ root: ctx.root, ref, dir, formFile, exec }),
  });
  for (const warning of grade.warnings) println(stderr, `warning: ${warning}`);
  const compared = ref === null ? `locks not compared — no ${base}` : `compared with ${base}`;
  return report(
    stdout,
    'check design — a design decision does not hold what it claims:',
    grade.violations,
    `check design — ${grade.screens} screen(s), ${grade.lockedScreens} locked; ${grade.lockedLaws} locked law(s); ${compared}.`,
  );
}

/** Where HEAD left `base`: what this branch changed is graded from there, never what `base` moved on to since. */
function mergeBase(ctx: Context, base: string, exec: Exec): string | null {
  try {
    return exec('git', ['merge-base', base, 'HEAD'], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

/** The ceilings file as commit `ref` holds it; `null` when it holds none, or none that parses: an install. */
function ceilingsAt(ctx: Context, ref: string, file: string, exec: Exec): Ceilings | null {
  let text: string;
  try {
    text = exec('git', ['show', `${ref}:${file}`], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
  try {
    return parseCeilings(text, file);
  } catch {
    return null;
  }
}

/** The PRD this checkout's pull request belongs to: `--prd`, else the one its branch works on. */
function prdOfCheckout(ctx: Context, prd: PrdNumber | null, exec: Exec): PrdNumber | null {
  if (prd !== null) return prd;
  const inbox = join(ctx.root, ctx.config.paths.delivery, 'inbox');
  const folders = existsSync(inbox) ? readdirSync(inbox) : [];
  return prdOfBranch(currentBranch(ctx.root, exec), { branches: ctx.config.branches, folders });
}

/** The raises a person said yes to in PRD `prd`'s outbox, read through its store; none without a PRD. */
async function raisesOf(ctx: Context, prd: PrdNumber | null): Promise<Raise[]> {
  if (prd === null) return [];
  try {
    return settledRaises(await outboxStore(ctx, prd).settledEntries(prd));
  } catch {
    return [];
  }
}

const CONTEXT_TITLE = 'check context — what every agent reads here is over its budget:';

// PRD 1679: what every agent session reads, measured and held to its ceilings by the ratchet against
// the base. Red on a target over budget or a ceiling raised with no person's yes; neutral — green,
// with why — when a target cannot be measured (D6); off while `budgets.context.enabled` is.
async function checkContext(io: CommandIo, { base, baseKnown, prd }: Range): Promise<boolean> {
  const { ctx, stdout, exec } = io;
  const budget = contextBudget(ctx.config);
  if (!budget.enabled) {
    println(stdout, formatPass('check context — budgets are off (budgets.context.enabled); nothing to check.'));
    return true;
  }
  let head: Ceilings;
  try {
    head = readCeilings({ root: ctx.root, file: budget.file });
  } catch (error) {
    return report(stdout, CONTEXT_TITLE, [messageOf(error)], '');
  }
  const ref = baseKnown ? mergeBase(ctx, base, exec) : null;
  const owner = prdOfCheckout(ctx, prd, exec);
  const verdicts = ratchet({
    base: ref === null ? null : ceilingsAt(ctx, ref, budget.file, exec),
    head,
    measures: measureContextBudget({ ctx }),
    raises: await raisesOf(ctx, owner),
  });
  const compared = ref === null ? `raises not compared — no ${base}` : `compared with ${base}`;
  const state = overall(verdicts);
  if (state === 'red') {
    const red = verdicts.filter(({ verdict }) => verdict === 'over-budget' || verdict === 'needs-yes');
    const growth = Object.fromEntries(red.map(({ target }) => [target, targetGrowth({ ctx, target, base: ref, exec })]));
    const context = { prd: owner, ceilingsFile: budget.file, growth };
    const lines = red.flatMap((verdict, index) => [...(index > 0 ? [''] : []), ...redMessage(verdict, context)]);
    return report(stdout, CONTEXT_TITLE, [...lines, '', ...budgetTable(verdicts)], '');
  }
  const word = state === 'neutral' ? 'neutral, nothing blocked' : 'every target under its ceiling';
  println(stdout, formatPass(`check context — ${verdicts.length} target(s), ${word}; ${compared}.`));
  for (const line of [...neutralLines(verdicts), ...budgetTable(verdicts)]) println(stdout, `  ${line}`);
  return true;
}

/** The repository's context; for `check config`, an invalid config is a red guard, never a stop. */
function contextFor(guard: string, cwd: string, exec: Exec, stdout: Out): Context | null {
  try {
    return loadContext(cwd, { exec });
  } catch (error) {
    if (guard !== 'config' || !(error instanceof ConfigError) || !error.invalid) throw error;
    const [first = '', ...others] = error.message.split('\n');
    report(stdout, CONFIG_TITLE, [first, ...others.map((line) => line.replace(/^\s*- /, ''))], '');
    return null;
  }
}

const GUARDS: readonly string[] = ['config', 'inbox', 'outbox', 'knowledge', 'kb', 'releases', 'agents', 'design', 'coverage', 'context', 'all'];

/** The guards that run alone and take nothing but the command's io. */
const SINGLE_GUARDS: Readonly<Record<string, (io: CommandIo) => boolean>> = {
  config: checkConfig,
  inbox: checkInbox,
  outbox: checkOutbox,
  kb: checkKb,
  releases: checkReleases,
  agents: checkAgents,
};

/** The one guard named (`all` when none); a usage error for more than one or an unknown one. */
function guardOf(positional: readonly string[]): string {
  if (positional.length > 1 || (positional[0] && !GUARDS.includes(positional[0]))) throw usageError(USAGE);
  return positional[0] ?? 'all';
}

interface Range {
  /** Where `omni` runs and what a test hands the Legal read (PRD 1795). */
  know: { cwd: string; reach: LegalReach };
  base: string;
  baseKnown: boolean;
  prd: PrdNumber | null;
}

/** The coverage guard's range, from `--base` and `--prd`. */
function rangeOf(guard: string, flags: Flags<'base' | 'prd', never>, io: CommandIo, know: Range['know']): Range {
  const { ctx, exec } = io;
  const prd = flags.prd === undefined ? null : prdArg('check', '--prd', flags.prd);
  const base = flags.base ?? defaultBase(ctx);
  const baseKnown = refExists(ctx, base, exec);
  // An explicit --base is the user's own ref: when it does not resolve, say so rather than skip.
  if (flags.base !== undefined && !baseKnown) {
    throw usageError(`omni check: no ${base} — fetch it or pass another --base <ref>.`);
  }
  const coverageRuns = guard === 'coverage' || (guard === 'all' && baseKnown);
  const contextRuns = guard === 'context' || (guard === 'all' && contextBudget(ctx.config).enabled);
  if (prd !== null && !coverageRuns && !contextRuns) println(io.stderr, `omni check: --prd ${prd} ignored — neither the coverage nor the context guard ran.`);
  return { know, base, baseKnown, prd };
}

/** `omni check coverage` alone: a missing base is a usage error, not a skip. */
function coverageOnly(io: CommandIo, { base, baseKnown, prd }: Range): boolean {
  if (!baseKnown) throw usageError(`omni check coverage: no ${base} — fetch it or pass --base <ref>.`);
  return checkCoverage(io, { base, prd });
}

/** `omni check all`: every guard, coverage skipped when the base is absent, context while budgets are on. */
async function allGuards(io: CommandIo, range: Range): Promise<boolean> {
  const { base, baseKnown, prd } = range;
  const results = [checkConfig(io), checkInbox(io), checkOutbox(io), await checkKnowledge(io, range.know), checkKb(io), checkReleases(io), checkAgents(io), checkDesign(io, { base, baseKnown })];
  if (baseKnown) results.push(checkCoverage(io, { base, prd }));
  else println(io.stdout, `coverage: skipped — no ${base}`);
  if (contextBudget(io.ctx.config).enabled) results.push(await checkContext(io, range));
  return results.every(Boolean);
}

/** Runs the guard named; `true` when it is green. */
async function runGuard(guard: string, io: CommandIo, range: Range): Promise<boolean> {
  const single = SINGLE_GUARDS[guard];
  if (guard === 'knowledge') return checkKnowledge(io, range.know);
  if (single) return single(io);
  if (guard === 'design') return checkDesign(io, range);
  if (guard === 'context') return checkContext(io, range);
  return guard === 'coverage' ? coverageOnly(io, range) : allGuards(io, range);
}

// A command without context, so that `check config` reads the config itself and turns an invalid one
// into a red guard (exit 1); every other guard still stops on it with exit 2, as before.
export const check: FreeCommand = {
  withoutContext: true,
  async run(args: string[], free: FreeIo & LegalReach): Promise<number> {
    const { cwd, stdout, stderr, exec, env, vars } = free;
    const { positional, flags } = parseArgs('check', args, { values: ['base', 'prd'] });
    const guard = guardOf(positional);
    const ctx = contextFor(guard, cwd, exec, stdout);
    if (ctx === null) return 1;
    const io: CommandIo = { ctx, stdout, stderr, exec, env, vars };
    return (await runGuard(guard, io, rangeOf(guard, flags, io, { cwd, reach: { tokens: free.tokens, home: free.home, fetch: free.fetch, callMs: free.callMs, now: free.now } }))) ? 0 : 1;
  },
};
