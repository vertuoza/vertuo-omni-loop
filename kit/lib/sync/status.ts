// `omni sync`'s rules (PRD 1990, spec sections 2, 3 and 5): one pure function from the facts a run
// gathered (`./facts.ts`) and the config's `sync` block to the record the cache keeps
// (`./schema.ts`). Nothing here reads a file, runs a process or asks the network.
//
// - Each check's facts become findings, each green, orange or red, in the order its rules run. A
//   fact that could not be gathered is one orange `not checked: <why>`, never red.
// - A finding's colour is the lower of its own and its check's level; a check whose level is `off`
//   gathered nothing and reads `off`.
// - The status is red when a finding is red, orange when one is orange, else green; its headline is
//   the first finding of that colour in the heaviest check (the first of `sync.order`) holding one.
// - A newcomer (no `setupDoneAt`) with a setup step open is blue, `Setting up · <k> of 4`. The first
//   run with all four steps done records `setupDoneAt`, and from then on the checkout is never blue.
import { compareVersions } from '../version/version.ts';
import type { Config } from '../types.ts';
import { isNotApplicable, isUnchecked } from './facts.ts';
import type { Fact, KitFacts, KnowledgeFacts, MainFacts, NotApplicable, PageFacts, PluginFact, SyncFacts, TargetCopyFact, TargetKitFact, Unchecked } from './facts.ts';
import { SEVERITIES } from './schema.ts';
import type { SetupStep, Severity, SyncFinding, SyncRecord } from './schema.ts';

/** The fix that `omni sync --fix` makes. */
const SYNC_FIX = 'omni sync --fix';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** How old the page's copy may be before the page check is orange. */
const PAGE_STALE_AFTER_MS = DAY;

/** What `omni sync --fix` does for a finding, in the order it does it (spec section 7). */
const DOES = ['switch', 'fast-forward', 'plugins', 'kit', 'page'] as const;
type Does = (typeof DOES)[number];

/** A finding before its check's level, and what `--fix` would do for it. */
type Raw = { severity: Severity; text: string; fix: string | null; does?: Does };

type Check = SyncFinding['check'];

const green = (text: string): Raw => ({ severity: 'green', text, fix: null });
const orange = (text: string, fix: string | null = null, does?: Does): Raw => ({ severity: 'orange', text, fix, ...(does ? { does } : {}) });
const red = (text: string, fix: string | null, does?: Does): Raw => ({ severity: 'red', text, fix, ...(does ? { does } : {}) });
const notChecked = ({ notChecked: why }: Unchecked, what?: string): Raw => orange(`not checked: ${why}${what ? ` (${what})` : ''}`);
const na = ({ na: why }: NotApplicable): Raw => green(`n/a · ${why}`);

/** `n` and its noun, singular for one. */
const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** How long `ms` is, in its largest whole unit: `40 s`, `5 min`, `3 h`, `2 d`. */
export function durationText(ms: number): string {
  const span = Math.max(0, ms);
  if (span < MINUTE) return `${Math.floor(span / SECOND)} s`;
  if (span < HOUR) return `${Math.floor(span / MINUTE)} min`;
  if (span < DAY) return `${Math.floor(span / HOUR)} h`;
  return `${Math.floor(span / DAY)} d`;
}

/** `sync.mainRedAfter` (`<n>h`) in milliseconds. */
const redAfterMs = (mainRedAfter: string): number => Number.parseInt(mainRedAfter, 10) * HOUR;

/** Where `HEAD` stands, as the main check's words name it. */
const onWhat = (branch: string | null): string => branch ?? 'a detached HEAD';

/** A counted fact's finding: `not checked` when it could not be read, `found(n)` when there are some, else none. */
function whenSome(fact: Fact<number>, what: string, found: (n: number) => Raw): Raw[] {
  if (isUnchecked(fact)) return [notChecked(fact, what)];
  return fact > 0 ? [found(fact)] : [];
}

/** A listed fact's findings: `not checked` when it could not be read, none when the part does not run, else each item's. */
function eachOf<T>(fact: Fact<readonly T[]> | null, what: string, findings: (item: T) => Raw[]): Raw[] {
  if (isUnchecked(fact)) return [notChecked(fact, what)];
  return (fact ?? []).flatMap(findings);
}

/** The behind rule's red finding: the default branch by its name in the main checkout, any other branch against the remote. */
function behindRed({ branch, defaultBranch, remote, linked }: MainFacts, count: number, age: string): Raw {
  const onDefault = !linked && branch === defaultBranch;
  const who = onDefault ? defaultBranch : `${branch ?? 'HEAD'} is ${count} behind ${remote}/${defaultBranch}`;
  const text = onDefault ? `${who} is ${count} behind, the oldest ${age} old` : `${who}, the oldest ${age} old`;
  return linked ? red(text, null) : red(text, SYNC_FIX, 'fast-forward');
}

/** The behind rule: red past `sync.mainRedAfter`, green before it. */
function behindFinding(facts: MainFacts, now: number, redAfter: number): Raw {
  const { behind, branch, defaultBranch, remote } = facts;
  if (isUnchecked(behind)) return notChecked(behind);
  if (behind.count === 0) return green(`on ${onWhat(branch)}, up to date with ${remote}/${defaultBranch}`);
  const ageMs = now - (behind.oldestAt ?? now);
  const age = durationText(ageMs);
  if (ageMs > redAfter) return behindRed(facts, behind.count, age);
  return green(`on ${onWhat(branch)}, ${behind.count} behind (the oldest ${age} old)`);
}

/** The main check: the behind rule everywhere; the branch, the changed files and the unpushed commits in the main checkout only. */
function mainFindings(facts: MainFacts, now: number, redAfter: number): Raw[] {
  const behind = behindFinding(facts, now, redAfter);
  if (facts.linked) return [behind];
  const { branch, defaultBranch, remote } = facts;
  const away = branch === defaultBranch ? [] : [orange(`on ${onWhat(branch)}: plans are made on ${defaultBranch}`, SYNC_FIX, 'switch')];
  return [
    behind,
    ...away,
    ...whenSome(facts.changed, 'the changed files', (n) => orange(`${counted(n, 'changed file', 'changed files')} on ${onWhat(branch)}`)),
    ...whenSome(facts.unpushed, `${defaultBranch} against ${remote}`, (n) => orange(`${defaultBranch} has ${counted(n, 'commit', 'commits')} not on ${remote}`)),
  ];
}

/** Whether version `a` is older than `b`, `b` being `null` when the latest release is unknown. */
const older = (a: string, b: string | null): b is string => b !== null && compareVersions(a, b) < 0;

/** A plugin's finding: not installed once the setup is done, or behind the latest release. */
function pluginFindings(plugin: PluginFact, latest: string | null, setupDone: boolean): Raw[] {
  if (plugin.version === null) return setupDone ? [orange(`${plugin.name} not installed`, plugin.fix)] : [];
  return older(plugin.version, latest) ? [red(`${plugin.label} v${plugin.version}, latest v${latest}`, SYNC_FIX, 'plugins')] : [];
}

/** A target repository's finding: not read, no kit, or a kit behind the latest release. */
function targetKitFindings(target: TargetKitFact, latest: string | null): Raw[] {
  if (isUnchecked(target)) return [notChecked(target, target.repo)];
  if (target.version === null) return [orange(`${target.repo} has no kit`)];
  return older(target.version, latest) ? [orange(`${target.repo} kit v${target.version}, latest v${latest}`, `omni update (in ${target.repo})`)] : [];
}

/** The repository's kit: not read, or behind the latest release. */
function repoKitFindings(repo: Fact<string | null>, latest: string | null): Raw[] {
  if (isUnchecked(repo)) return [notChecked(repo, 'the repository kit')];
  return repo !== null && older(repo, latest) ? [red(`repo kit v${repo}, latest v${latest}`, SYNC_FIX, 'kit')] : [];
}

/** The kit check: the repository's kit, the plugins and the target repositories against the latest release.
 * A kit or a plugin of this computer behind the release is red before the level, which is orange by
 * default: a lead who sets `sync.levels.kit: red` makes the whole team see red until they update. */
function kitFindings(facts: Exclude<KitFacts, NotApplicable | Unchecked>, setupDone: boolean): Raw[] {
  const latest = isUnchecked(facts.latest) ? null : facts.latest;
  return [
    ...(isUnchecked(facts.latest) ? [notChecked(facts.latest, 'the latest release')] : []),
    ...repoKitFindings(facts.repo, latest),
    ...eachOf(facts.plugins, 'the plugins', (plugin) => pluginFindings(plugin, latest, setupDone)),
    ...facts.targets.flatMap((target) => targetKitFindings(target, latest)),
  ];
}

const KNOWLEDGE_REFRESH = '/omni:invade --refresh';
const TARGETS_REFRESH = '/omni:mega-invade --refresh';

/** A target copy's finding: drifted, stale, or not reached. */
function copyFindings({ repo, state }: TargetCopyFact): Raw[] {
  if (state === 'drifted') return [orange(`${repo} knowledge drifted`, TARGETS_REFRESH)];
  if (state === 'stale') return [red(`${repo} knowledge stale`, TARGETS_REFRESH)];
  return state === 'unreachable' ? [notChecked({ notChecked: 'unreachable' }, repo)] : [];
}

/** The knowledge check: stale evidence, the target copies, and the knowledge files changed here. */
function knowledgeFindings({ staleEvidence, targets, changed }: Exclude<KnowledgeFacts, NotApplicable | Unchecked>): Raw[] {
  return [
    ...whenSome(staleEvidence, 'the playbook evidence', (n) => orange(`${counted(n, 'playbook entry cites', 'playbook entries cite')} changed files`, KNOWLEDGE_REFRESH)),
    ...eachOf(targets, 'the target copies', copyFindings),
    ...whenSome(changed, 'the knowledge folder', (n) => orange(`${counted(n, 'knowledge file', 'knowledge files')} changed here`)),
  ];
}

/** The page check: the sign-in, then how old the page's copy is. */
function pageFindings(facts: Exclude<PageFacts, NotApplicable | Unchecked>, now: number): Raw[] {
  const { signedIn, syncedAt, answering } = facts;
  if (!signedIn) return [orange('not signed in', 'omni signin')];
  if (syncedAt === null) return [orange('the page never synced', SYNC_FIX, 'page')];
  const age = durationText(now - syncedAt);
  if (!answering || now - syncedAt > PAGE_STALE_AFTER_MS) return [orange(`the page last synced ${age} ago`, SYNC_FIX, 'page')];
  return [green(`signed in · synced ${age} ago`)];
}

/** A check's findings from its facts: none when it is off (`null`), green when it does not apply, one orange when it could not be gathered. */
function judged<F extends object>(of: F | NotApplicable | Unchecked | null, rules: (facts: F) => Raw[]): Raw[] | null {
  if (of === null) return null;
  if (isNotApplicable(of)) return [na(of)];
  if (isUnchecked(of)) return [notChecked(of)];
  return rules(of);
}

/** One check's findings before its level: `null` when the check is off. */
function checkFindings(check: Check, facts: SyncFacts, sync: Config['sync'], setupDone: boolean): Raw[] | null {
  if (check === 'main') return judged(facts.main, (main) => mainFindings(main, facts.now, redAfterMs(sync.mainRedAfter)));
  if (check === 'kit') return judged(facts.kit, (kit) => kitFindings(kit, setupDone));
  if (check === 'knowledge') return judged(facts.knowledge, knowledgeFindings);
  return judged(facts.page, (page) => pageFindings(page, facts.now));
}

/** The words a check with nothing to say prints. */
const IN_SYNC = 'in sync';

/** `severity`, capped at `level`. */
function capped(severity: Severity, level: Config['sync']['levels'][Check]): Severity {
  if (level === 'off') return 'green';
  return SEVERITIES.indexOf(severity) > SEVERITIES.indexOf(level) ? level : severity;
}

/** The newcomer's four steps, with their lines: the plugins (skipped without `claude`), the sign-in, and `main` pulled. */
function setupSteps({ setup, defaultBranch }: SyncFacts, mainPulled: boolean): SetupStep[] {
  const plugin = (step: 'plugin' | 'hud', label: string, { done, fix }: { done: boolean; fix: string }): SetupStep => {
    if (!setup.claude) return { step, done: true, text: `${label}: not Claude: skipped`, fix: null };
    return done ? { step, done, text: `${label} installed`, fix: null } : { step, done, text: `Install the ${label}`, fix };
  };
  return [
    plugin('plugin', 'Omni plugin', setup.plugin),
    plugin('hud', 'HUD plugin', setup.hud),
    setup.signedIn
      ? { step: 'signin', done: true, text: 'Signed in to the Omni page', fix: null }
      : { step: 'signin', done: false, text: 'Sign in to the Omni page', fix: 'omni signin' },
    mainPulled
      ? { step: 'main', done: true, text: `${defaultBranch} pulled`, fix: null }
      : { step: 'main', done: false, text: `Pull ${defaultBranch}`, fix: SYNC_FIX },
  ];
}

/** The fix line's text: what `omni sync --fix` would do, else the headline's own fix, else none. */
function fixLine(raw: readonly Kept[], defaultBranch: string, headline: SyncFinding | undefined): string | null {
  const open = raw.filter(({ finding }) => finding.severity !== 'green');
  const does = DOES.filter((step) => open.some((entry) => entry.does === step && entry.finding.fix === SYNC_FIX));
  const words: Record<Does, string> = {
    switch: `switches to ${defaultBranch}`,
    'fast-forward': `fast-forwards ${defaultBranch}`,
    plugins: 'updates the plugins',
    kit: "opens the kit's update PR",
    page: "refreshes the page's copy",
  };
  if (does.length > 0) return `${SYNC_FIX}  (${does.map((step) => words[step]).join(', ')})`;
  return headline?.fix ?? open.find(({ finding }) => finding.fix !== null)?.finding.fix ?? null;
}

/** A finding as the record keeps it, with what `--fix` would do for it. */
type Kept = { finding: SyncFinding; does?: Does | undefined };

/** One check's findings after its level: `off` when it is off, `in sync` when it has nothing to say. */
function leveled(check: Check, found: Raw[] | null, level: Config['sync']['levels'][Check]): Kept[] {
  if (found === null || level === 'off') return [{ finding: { check, severity: 'green', text: 'off', fix: null } }];
  const shown = found.length > 0 ? found : [green(IN_SYNC)];
  return shown.map(({ severity, text, fix, does }) => ({ finding: { check, severity: capped(severity, level), text, fix }, does }));
}

/** The status the findings make: red when one is red, orange when one is orange, else green. */
function statusOf(findings: readonly SyncFinding[]): Severity {
  const worst = Math.max(...findings.map(({ severity }) => SEVERITIES.indexOf(severity)), 0);
  return SEVERITIES[worst] ?? 'green';
}

/** The record of one run: its findings, its status and headline, the newcomer's steps, and the fix line. */
export function syncStatus(facts: SyncFacts, sync: Config['sync']): SyncRecord {
  const checkedAt = new Date(facts.now).toISOString();
  const setupDone = facts.setupDoneAt !== null;
  const found = sync.order.map((check) => ({ check, raw: checkFindings(check, facts, sync, setupDone) }));
  const kept = found.flatMap(({ check, raw }) => leveled(check, raw, sync.levels[check]));
  const findings = kept.map(({ finding }) => finding);
  const mainPulled = !found.some(({ check, raw }) => check === 'main' && raw?.some(({ severity }) => severity === 'red'));
  const steps = setupSteps(facts, mainPulled);
  const done = steps.filter((step) => step.done).length;
  if (!setupDone && done < steps.length) {
    const next = steps.find((step) => !step.done);
    return { checkedAt, status: 'blue', headline: next?.text ?? null, setupDoneAt: null, setup: { done, steps }, findings, fix: null };
  }
  const status = statusOf(findings);
  const record = { checkedAt, status, setupDoneAt: facts.setupDoneAt ?? checkedAt, setup: null, findings };
  if (status === 'green') return { ...record, headline: null, fix: null };
  const headline = headlineOf(findings, sync.order, status);
  return { ...record, headline: headline?.text ?? null, fix: fixLine(kept, facts.defaultBranch, headline) };
}

/** The first finding of `severity` in the heaviest check that holds one. */
function headlineOf(findings: readonly SyncFinding[], order: readonly Check[], severity: Severity): SyncFinding | undefined {
  for (const check of order) {
    const first = findings.find((finding) => finding.check === check && finding.severity === severity);
    if (first) return first;
  }
  return undefined;
}
