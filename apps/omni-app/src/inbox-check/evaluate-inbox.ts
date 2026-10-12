// `evaluateInbox`: the inbox check's verdict on a phase-0 PR (PRD 675), pure. Two snapshot folders,
// the PR's head branch, its changed paths and commits from the compare, and its PRD issue in; the
// check run's `{ name, conclusion, title, summary, gates, prd }` out — or `null` when the PR gets no
// inbox check at all (no config on the base, or a head branch that is not of the phase-0 shape).
//
// Config from base, delivery from head, the way the outbox check reads them: `base` holds the base
// branch's `.omni-loop/config.yml`, `head` holds the head's delivery folder (and knowledge domains).
// Every rule is the kit's, imported unchanged: `phase0Verdict` (what `omni phase0 <n>` prints),
// `inboxViolationsFor` (the inbox rules for this PRD's folder only, so a broken folder of another PRD
// never turns this PR red) and `gradePlan` (the part of `omni plan check <n>` that reads `plan.md`).
// The fourth gate, the PRD issue, is read here from what the caller fetched. The fifth, canon (PRD 839),
// grades the PRD's `spec.md` against the repository's business through the injected `canon` gate
// (../canon/canon.ts); it is neutral, never red, when it cannot judge, so it never fails a PR on its
// own failure.
//
// A roadmap's phase-0 PR (issue 1198) carries many PRDs and no plan: its branch is `branches.phase0`
// with `{topic}` = `roadmap-<topic>`, and it writes `<inbox>/roadmaps/<nnnn>-<topic>/roadmap.md`. When
// that file is on the head, the roadmap is graded as `omni roadmap check <n>` grades it
// (`gradeRoadmaps`, plan-repository rules included), and each of its rows gets the phase-0 verdict
// with no plan asked (`needsPlan: false`), the inbox folder, the PRD issue and canon gates, wave by
// wave. Every other topic is one PRD, as before.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_FILE, ConfigError, parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { createContext, type Context } from 'vertuo-omni-plan/kit/lib/context.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { inboxViolationsFor } from 'vertuo-omni-plan/kit/lib/inbox/check-inbox.ts';
import { gradePlan } from 'vertuo-omni-plan/kit/lib/inbox/plan-grade.ts';
import { parseFolderName } from 'vertuo-omni-plan/kit/lib/layout.ts';
import { gradeRoadmaps, roadmapFiles, type GradedRoadmap } from 'vertuo-omni-plan/kit/lib/roadmap/index.ts';
import { roadmapWaves, type RoadmapRow } from 'vertuo-omni-plan/kit/lib/roadmap/parse.ts';
import { targetFlows } from 'vertuo-omni-plan/kit/lib/plan-repo/copy-flow.ts';
import { phase0Verdict } from 'vertuo-omni-plan/kit/lib/policy/phase-0.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { CANON_GATE, neutral } from '../canon/canon.ts';
import { canonMarker } from './canon-actions.ts';
import type { Commit, IssueFacts } from './github.ts';

export type { IssueFacts } from './github.ts';

/**
 * One gate's verdict. `neutral`: the gate could not judge; it counts as ok. `title`: how a failed
 * gate reads in the title.
 */
export type Gate = {
  name: string;
  ok: boolean;
  reason: string;
  neutral?: boolean;
  title?: string | undefined;
  details?: string[];
  /** The roadmap row's PRD this gate grades, on a roadmap's phase-0 PR. */
  prd?: PrdNumber;
};

/** The PRD issue as fetched: one for a one-PRD phase-0 PR, or one per PRD of a roadmap. */
export type IssuesOf = IssueFacts | ((prd: PrdNumber) => IssueFacts);

/** What the canon gate found. `state` is `green`, `red` or `neutral`. */
export type CanonGateFacts = {
  state: string;
  reason: string;
  claimsRead: number;
  findings: { quote: string; claims: string[]; why: string }[];
  persona: { name: string; line: string } | null;
  /** Who decided a constituents verdict (PRD 871), when the product has constituents. */
  judge?: { decidedBy: string | null; confidence: number | null } | null;
};

/**
 * The canon gate (../canon/canon.ts): grades a spec against the repository's business and its
 * product's constituents; `ref` (`PRD <n>`) is what a Jev call is recorded against.
 */
export type CanonGrader = {
  grade: (input: { repo: string; spec: string; ref?: string | null }) => Promise<Gate & { canon: CanonGateFacts }>;
};

export type InboxVerdict = {
  name: string;
  prd: PrdNumber | null;
  conclusion: 'success' | 'failure';
  title: string;
  summary: string;
  gates: Gate[];
  canon: CanonGateFacts | null;
};

/** The `{topic}` a head branch was cut for, read back through `branches.phase0`, or `null`. */
export function phase0Topic(headRef: unknown, template: string): string | null {
  if (typeof headRef !== 'string' || !template.includes('{topic}')) return null;
  const [prefix = '', suffix = ''] = template.split('{topic}');
  if (headRef.length <= prefix.length + suffix.length) return null;
  if (!headRef.startsWith(prefix) || !headRef.endsWith(suffix)) return null;
  return headRef.slice(prefix.length, headRef.length - suffix.length) || null;
}

/** The parsed base config, or `null` when the base has none or it does not parse. */
function readConfigAt(base: string): Config | null {
  const file = join(base, CONFIG_FILE);
  if (!existsSync(file)) return null;
  try {
    return parseConfig(readFileSync(file, 'utf8'), CONFIG_FILE);
  } catch (error) {
    if (error instanceof ConfigError) return null;
    throw error;
  }
}

/** The PRD number of the inbox folder `<nnnn>-<topic>` in the head snapshot, or `null`. */
export function inboxPrd({ head, config, topic }: { head: string; config: Config; topic: string }): PrdNumber | null {
  const dir = join(head, createContext(head, config).layout.dirs.inbox);
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const parsed = entry.isDirectory() ? parseFolderName(entry.name) : null;
    if (parsed?.topic === topic) return parsed.prd;
  }
  return null;
}

/** The topic a roadmap's phase-0 branch names after `roadmap-`, or `null` for any other topic. */
function roadmapTopic(topic: string): string | null {
  return topic.startsWith(ROADMAP_PREFIX) && topic.length > ROADMAP_PREFIX.length ? topic.slice(ROADMAP_PREFIX.length) : null;
}

const ROADMAP_PREFIX = 'roadmap-';

/** Where a roadmap of `topic` would sit, as the "no inbox folder" failure names it. */
function roadmapPathOf(config: Config, topic: string): string {
  return `${createContext('.', config).layout.dirs.inbox}/roadmaps/<nnnn>-${topic}/roadmap.md`;
}

/**
 * The roadmap a `roadmap-<topic>` phase-0 branch was cut for, graded as `omni roadmap check <n>`
 * grades it, when its `roadmaps/<nnnn>-<topic>/roadmap.md` is in the head snapshot; else `null`.
 */
function inboxRoadmap({ head, config, topic }: { head: string; config: Config; topic: string }): GradedRoadmap | null {
  const wanted = roadmapTopic(topic);
  if (wanted === null) return null;
  const ctx = createContext(head, config);
  const entry = roadmapFiles(ctx).find(
    (file) => parseFolderName(file.dir.slice(file.dir.lastIndexOf('/') + 1))?.topic === wanted && existsSync(join(head, file.file)),
  );
  if (!entry) return null;
  return gradeRoadmaps(ctx).find((graded) => graded.dir === entry.dir) ?? null;
}

/** The PRDs whose issues a phase-0 PR's grade reads: the roadmap's rows, or the one PRD's. */
export function phase0Prds({ head, config, topic }: { head: string; config: Config; topic: string }): PrdNumber[] {
  const roadmap = inboxRoadmap({ head, config, topic });
  if (roadmap) return (roadmap.roadmap?.prds ?? []).map((row) => row.prd);
  const prd = inboxPrd({ head, config, topic });
  return prd === null ? [] : [prd];
}

/** `repo`: the PR's `owner/name`; `canon`: the canon gate, neutral when none is given. */
export async function evaluateInbox({
  base,
  head,
  pr,
  repo,
  changes,
  commits,
  issue,
  canon,
}: {
  base: string;
  head: string;
  pr: { headRef: string };
  repo?: string;
  changes: { path: string; status?: string }[] | null | undefined;
  commits: Commit[];
  issue: IssuesOf;
  canon?: CanonGrader | null | undefined;
}): Promise<InboxVerdict | null> {
  const config = readConfigAt(base);
  if (!config) return null;
  const topic = phase0Topic(pr.headRef, config.branches.phase0);
  if (topic === null) return null;

  const name = config.ci.inboxContext;
  const ctx = createContext(head, config);
  const issueOf = (prd: PrdNumber): IssueFacts => (typeof issue === 'function' ? issue(prd) : issue);
  const roadmap = inboxRoadmap({ head, config, topic });
  if (roadmap) return evaluateRoadmap({ name, ctx, roadmap, changes, commits, issueOf, canon, head, repo });

  const prd = inboxPrd({ head, config, topic });
  if (prd === null) {
    const title = `no inbox folder for topic \`${topic}\``;
    const rest = roadmapTopic(topic);
    const roadmapLine = rest === null ? '' : `, and no roadmap at \`${roadmapPathOf(config, rest)}\``;
    return {
      name,
      prd,
      conclusion: 'failure',
      title,
      summary: `${title} under \`${config.paths.delivery}\` on the head branch \`${pr.headRef}\`${roadmapLine}.`,
      gates: [],
      canon: null,
    };
  }

  const gates: Gate[] = [
    phase0Gate({ ctx, prd, changes, commits }),
    inboxGate({ ctx, prd }),
    planGate({ ctx, prd, head }),
    issueGate({ prd, issue: issueOf(prd), label: config.labels.prd }),
  ];
  const { canon: facts, ...canonGate } = await canonGateOf({ canon, ctx, prd, head, repo });
  gates.push(canonGate);
  return {
    name,
    prd,
    conclusion: gates.every((gate) => gate.ok) ? 'success' : 'failure',
    title: titleOf(gates),
    summary: summaryOf({ prd, folder: placeOf(ctx, prd).name, gates, marker: canonMarker({ prd, canon: facts }) }),
    gates,
    canon: facts,
  };
}

/** One roadmap row, graded: its gates, each carrying its PRD, and what its canon gate found. */
type GradedRow = { row: RoadmapRow; gates: Gate[]; facts: CanonGateFacts };

/**
 * A roadmap's phase-0 PR: the roadmap gate, then each row wave by wave with its phase-0 verdict (no
 * plan asked), inbox folder, PRD issue and canon gates. A red canon's facts are the first red row's.
 */
async function evaluateRoadmap({
  name,
  ctx,
  roadmap,
  changes,
  commits,
  issueOf,
  canon,
  head,
  repo,
}: {
  name: string;
  ctx: Context;
  roadmap: GradedRoadmap;
  changes: { path: string }[] | null | undefined;
  commits: Commit[];
  issueOf: (prd: PrdNumber) => IssueFacts;
  canon: CanonGrader | null | undefined;
  head: string;
  repo: string | undefined;
}): Promise<InboxVerdict> {
  const waves = roadmap.roadmap ? roadmapWaves(roadmap.roadmap) : [];
  const size = `${plural(waves.flatMap((wave) => wave.rows).length, 'PRD')} in ${plural(waves.length, 'wave')}`;
  const roadmapGate: Gate =
    roadmap.violations.length === 0
      ? { name: 'roadmap', ok: true, reason: `${size}: every row, blocker and question holds` }
      : { name: 'roadmap', ok: false, reason: roadmap.violations.join('; ') };
  const graded = await Promise.all(
    waves.flatMap((wave) => wave.rows).map(async (row): Promise<GradedRow> => {
      const { canon: facts, ...canonGate } = await rowCanonGate({ canon, ctx, prd: row.prd, head, repo });
      const gates = [...rowGates({ ctx, prd: row.prd, changes, commits, issue: issueOf(row.prd) }), canonGate];
      return { row, gates: gates.map((gate) => ({ ...gate, prd: row.prd })), facts };
    }),
  );
  const gates = [roadmapGate, ...graded.flatMap((entry) => entry.gates)];
  const ok = gates.every((gate) => gate.ok);
  return {
    name,
    prd: null,
    conclusion: ok ? 'success' : 'failure',
    title: ok ? `Roadmap ${roadmap.number} complete: ${size}, every gate ok · ${canonTail(gates)}` : `Not ok: ${failedByName(gates)}`,
    summary: roadmapSummary({ ctx, roadmap, roadmapGate, graded }),
    gates,
    canon: graded.find((entry) => entry.facts.state === 'red')?.facts ?? null,
  };
}

/** The roadmap named, its gate, then each wave's rows with their gates; a red canon's marker last. */
function roadmapSummary({ ctx, roadmap, roadmapGate, graded }: { ctx: Context; roadmap: GradedRoadmap; roadmapGate: Gate; graded: GradedRow[] }): string {
  const name = roadmap.roadmap ? `Roadmap ${roadmap.roadmap.roadmap} — ${roadmap.roadmap.title}` : `Roadmap ${roadmap.number}`;
  const waves = roadmap.roadmap ? roadmapWaves(roadmap.roadmap) : [];
  const red = graded.find((entry) => entry.facts.state === 'red');
  const marker = red ? canonMarker({ prd: red.row.prd, canon: red.facts }) : null;
  return [
    `${name} (\`${roadmap.dir.slice(ctx.layout.dirs.inbox.length + 1)}\`)`,
    '',
    ...gateLines([roadmapGate]),
    ...waves.flatMap((wave) => [
      '',
      `### Wave ${wave.wave}`,
      ...wave.rows.flatMap((row) => ['', `#### ${rowHeading(ctx, row)}`, '', ...gateLines(graded.find((entry) => entry.row === row)?.gates ?? [])]),
    ]),
    ...(marker ? ['', marker] : []),
  ].join('\n');
}

/** `canon neutral` when no row's canon could judge, else how many rows it judged. */
function canonTail(gates: Gate[]): string {
  const canon = gates.filter((gate) => gate.name === CANON_GATE);
  const judged = canon.filter((gate) => !gate.neutral);
  return judged.length === 0 ? 'canon neutral' : `canon ✓ on ${judged.length} of ${plural(canon.length, 'PRD')}`;
}

/** The phase-0 verdict with no plan asked, the inbox folder and the PRD issue of one roadmap row. */
function rowGates({
  ctx,
  prd,
  changes,
  commits,
  issue,
}: {
  ctx: Context;
  prd: PrdNumber;
  changes: { path: string }[] | null | undefined;
  commits: Commit[];
  issue: IssueFacts;
}): Gate[] {
  const label = ctx.config.labels.prd;
  if (ctx.layout.whereIs(prd) === null) {
    return [{ name: 'inbox folder', ok: false, reason: `PRD ${prd} has no folder in the inbox` }, issueGate({ prd, issue, label })];
  }
  return [phase0Gate({ ctx, prd, changes, commits, needsPlan: false }), inboxGate({ ctx, prd }), issueGate({ prd, issue, label })];
}

/** The canon gate on a roadmap row's spec; neutral when the row has no folder. */
function rowCanonGate(args: { canon: CanonGrader | null | undefined; ctx: Context; prd: PrdNumber; head: string; repo: string | undefined }) {
  if (args.ctx.layout.whereIs(args.prd) === null) return Promise.resolve(neutral(`PRD ${args.prd} has no folder in the inbox`));
  return canonGateOf(args);
}

/** `P1 · PRD 10 — Alpha (\`0010-alpha\`)`. */
function rowHeading(ctx: Context, row: RoadmapRow): string {
  const folder = ctx.layout.whereIs(row.prd)?.name ?? 'no folder';
  return `${row.id} · PRD ${row.prd} — ${row.title} (\`${folder}\`)`;
}

/** Each failed gate by name, with the PRDs it failed for: `PRD issue (PRD 11)`. */
function failedByName(gates: Gate[]): string {
  const failed = new Map<string, PrdNumber[]>();
  for (const gate of gates.filter((candidate) => !candidate.ok)) {
    const prds = failed.get(gate.name) ?? [];
    if (gate.prd !== undefined) prds.push(gate.prd);
    failed.set(gate.name, prds);
  }
  return [...failed].map(([name, prds]) => (prds.length === 0 ? name : `${name} (PRD ${prds.join(', ')})`)).join(', ');
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The canon gate on the PRD's `spec.md`; neutral when no gate is wired or there is no spec to read. */
async function canonGateOf({
  canon,
  ctx,
  prd,
  head,
  repo,
}: {
  canon: CanonGrader | null | undefined;
  ctx: Context;
  prd: PrdNumber;
  head: string;
  repo: string | undefined;
}): Promise<Gate & { canon: CanonGateFacts }> {
  if (!canon || !repo) return neutral('the canon gate is not wired here');
  const file = join(head, inFolder(ctx.layout.specPath(prd), prd));
  if (!existsSync(file)) return neutral(`no spec.md in ${placeOf(ctx, prd).dir}`);
  return canon.grade({ repo, spec: readFileSync(file, 'utf8'), ref: `PRD ${prd}` });
}

/** Where the PRD's folder is; it is there, since its number was read from it. */
function placeOf(ctx: Context, prd: PrdNumber): { name: string; dir: string } {
  const place = ctx.layout.whereIs(prd);
  if (!place) throw new Error(`PRD ${prd} has no folder in the head snapshot.`);
  return place;
}

/** A file of the PRD's folder; it is there, since its number was read from it. */
function inFolder(file: string | null, prd: PrdNumber): string {
  if (file === null) throw new Error(`PRD ${prd} has no folder in the head snapshot.`);
  return file;
}

/** Every failed gate by its title; else how many judged gates are ok, with the canon gate's word. */
function titleOf(gates: Gate[]): string {
  const failed = gates.filter((gate) => !gate.ok);
  if (failed.length > 0) return `Not ok: ${failed.map((gate) => gate.title ?? gate.name).join(', ')}`;
  const judged = gates.filter((gate) => !gate.neutral);
  const canon = gates.find((gate) => gate.name === CANON_GATE);
  const tail = canon?.neutral ? ' · canon neutral' : ` · ${canon?.reason}`;
  return `Phase-0 PR complete: ${judged.length} of ${judged.length} gates ok${tail}`;
}

function phase0Gate({
  ctx,
  prd,
  changes,
  commits,
  needsPlan = true,
}: {
  ctx: Context;
  prd: PrdNumber;
  changes: { path: string }[] | null | undefined;
  commits: Commit[];
  needsPlan?: boolean;
}): Gate {
  const verdict = phase0Verdict(
    (changes ?? []).map((change) => change.path),
    { ctx, prd, commits, needsPlan },
  );
  return { name: 'phase-0 verdict', ok: verdict.ok, reason: verdict.reason };
}

function inboxGate({ ctx, prd }: { ctx: Context; prd: PrdNumber }): Gate {
  const violations = inboxViolationsFor({ ctx, prd });
  return violations.length === 0
    ? { name: 'inbox folder', ok: true, reason: `${placeOf(ctx, prd).dir} follows the inbox rules` }
    : { name: 'inbox folder', ok: false, reason: violations.join('; ') };
}

function planGate({ ctx, prd, head }: { ctx: Context; prd: PrdNumber; head: string }): Gate {
  const file = inFolder(ctx.layout.planPath(prd), prd);
  const absolute = join(head, file);
  if (!existsSync(absolute)) {
    return { name: 'plan', ok: false, reason: `no plan.md in ${placeOf(ctx, prd).dir}` };
  }
  const graded = gradePlan(readFileSync(absolute, 'utf8'), { config: ctx.config, targets: targetFlows({ root: head, config: ctx.config }) });
  if (graded.violations.length > 0) return { name: 'plan', ok: false, reason: graded.violations.join('; ') };
  const slices = graded.slices.length;
  const waves = graded.waves.length;
  return {
    name: 'plan',
    ok: true,
    reason: `${slices} slice${slices === 1 ? '' : 's'} in ${waves} wave${waves === 1 ? '' : 's'}, no collision`,
  };
}

function issueGate({ prd, issue, label }: { prd: PrdNumber; issue: IssueFacts; label: string }): Gate {
  const fail = (reason: string): Gate => ({ name: 'PRD issue', ok: false, reason });
  if (!issue) return fail(`issue #${prd} does not exist`);
  if (issue.isPullRequest) return fail(`#${prd} is a pull request, not an issue`);
  if (issue.state !== 'open') return fail(`issue #${prd} is ${issue.state}`);
  if (!issue.labels.includes(label)) return fail(`issue #${prd} does not carry the label ${label}`);
  return { name: 'PRD issue', ok: true, reason: `issue #${prd} is open and carries ${label}` };
}

/** The gates line by line; a red canon's facts last, hidden, for its buttons (./canon-actions.ts). */
function summaryOf({ prd, folder, gates, marker }: { prd: PrdNumber; folder: string; gates: Gate[]; marker: string | null }): string {
  return [`PRD ${prd} (\`${folder}\`)`, '', ...gateLines(gates), ...(marker ? ['', marker] : [])].join('\n');
}

/** One line per gate, its details indented below it. */
function gateLines(gates: Gate[]): string[] {
  return gates.flatMap((gate) => [
    `- ${gate.neutral ? 'neutral' : gate.ok ? 'ok' : 'not ok'} — ${gate.name}: ${gate.reason}`,
    ...(gate.details ?? []).map((detail) => `  - ${detail}`),
  ]);
}
