// `render`: the runs `retro.json` keeps and the prose `guard` accepted in, `retro.md`, `retro.json`
// and the retro PR's title and body out (PRD 72, "The retro PR"). Pure.
//
// Every number `render` writes is read from a run record — the fact sheet `detect` made, plus the
// narration's outcome and the issues published — and `retro.json` holds exactly those records, so any
// number in `retro.md` can be checked against it. The prose only ever fills words around the facts:
// a summary, a title, why a finding matters, lessons; with none, the summary reads
// "Facts only: <reason>".
//
// `retro.md` holds, in order: the summary, every finding (ranked, with what happened, why it matters,
// the lesson and its evidence), the proposed lessons, one section per kind that has something to say
// (its own lines, then its findings, in the registry's order), the rules the run used, and the
// sections of the kinds that take part only in the day-14 run. Each finding the judge kept (PRD 487)
// is marked kept, with its `why`, and the front matter names the judge's version (`judge:`).
//
// When the retro is not worth a pull request, or was not judged, nothing of that is written:
// `verdictComment` gives instead the one comment the retro keeps on the merged feature PR.
import type { PrNumber, PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { z } from 'zod';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { parseOrThrow } from 'vertuo-omni-plan/kit/lib/schema/parse-or-throw.ts';
import { RetroDocSchema } from './github.schema.ts';
import { RunRecordSchema } from './retro.schema.ts';
import { KINDS, type Kind } from './kinds/index.ts';
import { JUDGE_VERSION } from './narrate.ts';
import type { Evidence, IssueLink, IssueLinks, Prose, ProseField, ProseFinding, RepositoryFacts, RetroDoc, RulesSheet, Run, RunRecord, SheetFinding } from './retro.types.ts';

export type { RetroDoc, RunRecord };

/**
 * A run, as far as the checks below read it: its kinds' facts, by kind, which each reader parses with
 * the schema of the facts it reads.
 */
type KeptRun = { featurePr?: { number?: PrNumber } | null; kinds?: Record<string, unknown> | null };
/** A finding of a kept run, as far as the checks below read it. */
type KeptFinding = { evidence?: readonly Evidence[] | null };

/** The facts kind `id` left in a kept run, if it left any. */
const keptFacts = (run: KeptRun, id: string): unknown => run.kinds?.[id];

/** The timeline kind's facts, as far as the verdict comment reads them (`kinds/timeline.ts`). */
const TimelineFactsSchema = z
  .object({
    featurePr: z.object({ minutes: z.number().nullish() }).nullish(),
    sliceCount: z.number().exactOptional(),
    waves: z.object({ merged: z.number(), planned: z.number().nullable() }),
  })
  .nullable();

/**
 * `retro.json`'s content with `record` in it: a replay replaces the record of the same feature PR and
 * run, anything else is added. A file that is not the retro's JSON is started again. `existing` is
 * the file's text on the retro branch, or `null`. Each run the file keeps is parsed as a run record:
 * one of another shape, as written before a deploy that changed it, fails, naming the field.
 */
export function mergeRuns(existing: string | null, record: RunRecord): RetroDoc {
  let doc: unknown = null;
  try {
    doc = existing ? JSON.parse(existing) : null;
  } catch {
    doc = null;
  }
  const runs = parseOrThrow(z.array(RunRecordSchema), RetroDocSchema.parse(doc).runs, 'The retro.json on the retro branch keeps a run of an unexpected shape');
  const same = (run: RunRecord) => run.featurePr.number === record.featurePr.number && run.run === record.run;
  const index = runs.findIndex(same);
  const next = index === -1 ? [...runs, record] : runs.map((run, i) => (i === index ? record : run));
  return { prd: record.prd.number, runs: next };
}

/** The retro PR's title: `docs(retro): PRD <n> — <PRD title>`. */
export function retroTitle(prd: { number: PrdNumber; title: string }): string {
  return `docs(retro): PRD ${prd.number} — ${prd.title}`;
}

export function render({
  doc,
  featurePr,
  prose = null,
  kinds = KINDS,
}: {
  doc: RetroDoc;
  featurePr: number;
  prose?: Prose | null;
  kinds?: readonly Kind[];
}): { markdown: string; json: string; title: string; prBody: string } {
  const runs = doc.runs.filter((run) => run.featurePr.number === featurePr);
  const latest = runs.at(-1);
  if (!latest) throw new Error(`render: retro.json holds no run of #${featurePr}.`);
  const findings = uniqueFindings(runs);
  const issues: IssueLinks = Object.fromEntries(runs.flatMap((run) => Object.entries(run.issues ?? {})));
  const repositories = [...runs].reverse().find((run) => run.repositories)?.repositories ?? null;
  const shown: Shown = { runs, findings, prose, issues, repositories };

  const lines = [
    '---',
    `prd: ${latest.prd.number}`,
    `feature-pr: ${latest.featurePr.number}`,
    `merge-sha: ${latest.featurePr.mergeSha.slice(0, 7)}`,
    `runs: [${runs.map((run) => run.run).join(', ')}]`,
    `model: ${latest.narration?.model ?? 'none'}`,
    `rules: ${latest.rules.version}`,
    `judge: ${JUDGE_VERSION}`,
    '---',
    '',
    `# Retro — PRD ${latest.prd.number}, ${latest.prd.title}`,
    '',
    summary(prose, latest),
    '',
    ...repositoriesSection(repositories),
    '## Findings',
    '',
    ...findingsSection(shown),
    '## Proposed lessons',
    '',
    ...lessons(prose, findings),
    '',
  ];

  const byRun = (run: Run) => kinds.filter((kind) => kind.runs.includes(run));
  const sectionOf = (kind: Kind) => kindSection(kind, runs, findings, prose, issues);
  const mergeSectionOf = (kind: Kind) => (repositories ? groupedSection(kind, shown) : sectionOf(kind));
  lines.push(...byRun('merge').flatMap(mergeSectionOf));
  lines.push(...rulesSection(latest.rules));
  lines.push(...kinds.filter((kind) => !kind.runs.includes('merge')).flatMap(sectionOf));

  return {
    markdown: `${lines.join('\n').replace(/\n+$/, '')}\n`,
    json: `${JSON.stringify(doc, null, 2)}\n`,
    title: retroTitle(latest.prd),
    prBody: prBody(latest, findings, prose, issues),
  };
}

/** Every finding of the runs, in run order, each id once (its first run's). */
function uniqueFindings(runs: readonly RunRecord[]): SheetFinding[] {
  const seen = new Set<string>();
  return runs.flatMap((run) => run.findings).filter((finding) => !seen.has(finding.id) && seen.add(finding.id));
}

/** A prose field as written: its text, the line naming why it was dropped, or `null` when not given. */
function field(value: ProseField | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && 'dropped' in value) return `_Dropped: ${value.dropped}._`;
  return value;
}

function summary(prose: Prose | null, latest: RunRecord): string {
  const text = field(prose?.summary);
  if (text) return text;
  return `Facts only: ${latest.narration?.reason ?? 'no prose'}`;
}

/** A finding's title: the model's when it gave one and it was kept, else the detector's own. */
function titleOf(finding: SheetFinding, prose: Prose | null): string {
  const given = prose?.findings[finding.id]?.title;
  return typeof given === 'string' && given ? given : finding.title;
}

function issueLink(issue: IssueLink | undefined): string | null {
  if (!issue) return null;
  return `[#${issue.number}](${issue.url})${issue.state === 'closed' ? ' (closed)' : ''}`;
}

function findingBlock(finding: SheetFinding, prose: Prose | null, issues: IssueLinks, level = '###'): string[] {
  const words: ProseFinding = prose?.findings[finding.id] ?? {};
  const issue = issueLink(issues[finding.id]);
  const droppedTitle = typeof words.title === 'object' ? field(words.title) : null;
  const heading = [`${level} ${finding.ref} · ${titleOf(finding, prose)} — \`${finding.id}\``, issue].filter(Boolean).join(' · ');
  const lines = [heading, ''];
  if (droppedTitle) lines.push(`- **Title:** ${droppedTitle}`);
  lines.push(`- **What happened:** ${finding.happened}`);
  const why = field(words.whyItMatters);
  if (why) lines.push(`- **Why it matters:** ${why}`);
  const lesson = field(words.lesson);
  if (lesson) lines.push(`- **Proposed lesson:** ${lesson}`);
  if (words.keep === true) lines.push(`- **Kept:** ${typeof words.why === 'string' && words.why ? words.why : 'yes'}`);
  const kept: KeptFinding = finding;
  const evidence = (kept.evidence ?? []).map((item) => `[${item.label}](${item.url})`);
  lines.push(`- **Evidence:** ${evidence.length > 0 ? evidence.join(', ') : 'none recorded'}`, '');
  return lines;
}

function lessons(prose: Prose | null, findings: readonly SheetFinding[]): string[] {
  const given = (prose?.lessons ?? []).filter((lesson) => lesson.text);
  if (given.length === 0) return [prose ? 'None proposed.' : 'None proposed: facts only.'];
  const refOf = new Map(findings.map((finding) => [finding.id, finding.ref]));
  return given.map((lesson) => {
    const refs = lesson.findings.map((id) => refOf.get(id)).filter(Boolean);
    return refs.length > 0 ? `- ${lesson.text} (${refs.join(', ')})` : `- ${lesson.text}`;
  });
}

/** One kind's section: its own lines from the latest run that has its facts, then its findings. */
function kindSection(kind: Kind, runs: readonly RunRecord[], findings: readonly SheetFinding[], prose: Prose | null, issues: IssueLinks): string[] {
  const facts = [...runs].reverse().map((run) => keptFacts(run, kind.id)).find((value) => value !== null && value !== undefined) ?? null;
  const own = findings.filter((finding) => finding.source === kind.id);
  const described = facts === null ? null : kind.describe(facts);
  if ((!described || described.length === 0) && own.length === 0) return [];
  const lines: string[] = [`## ${kind.section}`, ''];
  if (described && described.length > 0) lines.push(...described, '');
  lines.push(...findingsLine(own, prose, issues));
  return lines;
}

/** What a retro.md of several repositories reads beside its runs (PRD 1130); `repositories` is `null` for one repository. */
type Shown = { runs: readonly RunRecord[]; findings: readonly SheetFinding[]; prose: Prose | null; issues: IssueLinks; repositories: readonly RepositoryFacts[] | null };

/** The repositories a multi-repository PRD's retro read, the plan repository first: each one's feature PRs, or why it was not read. */
function repositoriesSection(repositories: readonly RepositoryFacts[] | null): string[] {
  if (!repositories) return [];
  const line = (one: RepositoryFacts) => {
    if (!one.read) return `- ${one.repo}: not read — ${one.reason ?? 'no reason given'}`;
    const pulls = one.featurePrs.map((pull) => (pull.url ? `[#${pull.number}](${pull.url})` : `#${pull.number}`)).join(', ');
    return `- ${one.repo}${one.plan ? ' (plan repository)' : ''}: feature PR ${pulls}`;
  };
  return ['## Repositories', '', ...repositories.map(line), ''];
}

/** The repository a finding is about: its own, else the plan repository's (a day-14 finding). */
function repoOf(finding: SheetFinding, repositories: readonly RepositoryFacts[]): string | undefined {
  return finding.repo ?? repositories.find((one) => one.plan)?.repo;
}

/** The Findings section: every finding, or, for several repositories, one subsection per repository with findings. */
function findingsSection({ findings, prose, issues, repositories }: Shown): string[] {
  if (findings.length === 0) return ['None: nothing crossed a threshold of the rules.', ''];
  if (!repositories) return findings.flatMap((finding) => findingBlock(finding, prose, issues));
  return repositories.flatMap((one) => {
    const own = findings.filter((finding) => repoOf(finding, repositories) === one.repo);
    return own.length === 0 ? [] : [`### ${one.repo}`, '', ...own.flatMap((finding) => findingBlock(finding, prose, issues, '####'))];
  });
}

/** One kind's facts in one repository: the plan repository's are the runs' own, a target's its line of `repositories`. */
function repositoryFacts(kind: Kind, runs: readonly RunRecord[], one: RepositoryFacts): unknown {
  for (const run of [...runs].reverse()) {
    const facts = one.plan ? keptFacts(run, kind.id) : run.repositories?.find((other) => other.repo === one.repo)?.kinds?.[kind.id];
    if (facts !== null && facts !== undefined) return facts;
  }
  return null;
}

/** A merge kind's section for several repositories: one subsection per repository read, its lines then its findings. */
function groupedSection(kind: Kind, { runs, findings, prose, issues, repositories }: Shown): string[] {
  const parts = (repositories ?? []).filter((one) => one.read).flatMap((one) => {
    const own = findings.filter((finding) => finding.source === kind.id && repoOf(finding, repositories ?? []) === one.repo);
    const facts = repositoryFacts(kind, runs, one);
    const described = facts === null ? null : kind.describe(facts);
    if ((!described || described.length === 0) && own.length === 0) return [];
    return [`### ${one.repo}`, '', ...(described && described.length > 0 ? [...described, ''] : []), ...findingsLine(own, prose, issues)];
  });
  return parts.length === 0 ? [] : [`## ${kind.section}`, '', ...parts];
}

/** The `Findings:` line under a kind's lines, or nothing when it has none. */
function findingsLine(own: readonly SheetFinding[], prose: Prose | null, issues: IssueLinks): string[] {
  if (own.length === 0) return [];
  const refs = own.map((finding) => [`${finding.ref} · ${titleOf(finding, prose)}`, issueLink(issues[finding.id])].filter(Boolean).join(' · '));
  return [`Findings: ${refs.join('; ')}`, ''];
}

function rulesSection(rules: RulesSheet): string[] {
  const t = rules.thresholds;
  const order = rules.findingOrder.map((rank) => rank.join(' or ')).join(', ');
  return [
    '## Rules',
    '',
    `Rules version ${rules.version}; the thresholds this run used:`,
    '',
    `- A slow slice: more than ${t.slowSliceFactor} times the median time from claim to merge.`,
    `- A repeated red check: red on ${t.repeatedRedCommits} or more commits, or in ${t.repeatedRedSlices} or more slices; any red then green on one commit is flaky.`,
    `- A failing test: the same test failing in ${t.failingTestRuns} or more runs.`,
    `- Churn: a line range rewritten in ${t.churnRangeCommits} or more commits; a file whose churn is at least ${t.churnFilePercent}% of its final added lines and at least ${t.churnFileLines} lines.`,
    `- After merge: the \`bug\` issues naming the PRD within ${t.afterMergeDays} days of the merge.`,
    `- At most ${rules.issuesPerRun} issues per run, most severe first: ${order}.`,
    '',
  ];
}

function prBody(latest: RunRecord, findings: readonly SheetFinding[], prose: Prose | null, issues: IssueLinks): string {
  const lines = [
    `Refs #${latest.prd.number}`,
    '',
    `The retro of PRD ${latest.prd.number}, ${latest.prd.title}: how its delivery went, counted from GitHub and its folder, in \`${latest.prd.folder}/retro.md\`, with every number it shows kept in \`retro.json\` beside it.`,
    '',
    '## Findings',
    '',
    ...(findings.length === 0
      ? ['None: nothing crossed a threshold of the rules.']
      : findings.map(
          (finding) =>
            `- ${[`${finding.ref} · ${titleOf(finding, prose)} — \`${finding.id}\``, issueLink(issues[finding.id])].filter(Boolean).join(' · ')}`,
        )),
    '',
    'Merging keeps this retro as history and changes nothing else.',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * The comment a retro not worth a pull request keeps on the merged feature PR, without its marker:
 * `Retro: no new lesson — <reason>` or `Retro: not judged — <reason>`, the timeline in two lines,
 * then one line per finding (its id, title and key). Pure.
 */
export function verdictComment({
  judged,
  reason,
  runs,
  prose = null,
}: {
  judged: boolean;
  reason: string;
  runs: readonly RunRecord[];
  prose?: Prose | null;
}): string {
  const first = at(runs, 0, 'the first run the retro comments on');
  const findings = uniqueFindings(runs);
  const kept = runs.map((run) => keptFacts(run, 'timeline')).find((facts) => facts) ?? null;
  const timeline = parseOrThrow(TimelineFactsSchema, kept, "The timeline kind's facts are of an unexpected shape");
  const minutes = timeline?.featurePr?.minutes ?? minutesBetween(first.featurePr.openedAt, first.featurePr.mergedAt);
  const lines = [
    `Retro: ${judged ? 'no new lesson' : 'not judged'} — ${oneLine(reason)}`,
    '',
    `- Feature PR #${first.featurePr.number}: ${minutes === null ? 'time not known' : `${minutes} minutes`} from open to merge.`,
    timeline
      ? `- ${timeline.sliceCount} slices in ${timeline.waves.merged} waves as merged${
          timeline.waves.planned === null ? '' : `, ${timeline.waves.planned} planned`
        }.`
      : '- Slices and waves: not counted.',
    '',
    ...(findings.length === 0
      ? ['No findings: nothing crossed a threshold of the rules.']
      : findings.map((finding) => `- ${finding.ref} · ${titleOf(finding, prose)} — \`${finding.id}\``)),
  ];
  return `${lines.join('\n')}\n`;
}

function minutesBetween(from: string | null, to: string | null): number | null {
  if (from === null || to === null) return null;
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) ? Math.round(ms / 60000) : null;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim() || 'no reason given';
}
