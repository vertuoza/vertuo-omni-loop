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
import { KINDS } from './kinds/index.mjs';
import { JUDGE_VERSION } from './narrate.mjs';

/**
 * @typedef {{ [findingId: string]: { number: number, url: string, state: 'open' | 'closed' } }} IssueLinks
 * @typedef {object} RunRecord  a fact sheet from `detect`, plus `narration: { model, reason, dropped }`
 *   and `issues: IssueLinks`
 * @typedef {{ prd: number, runs: RunRecord[] }} RetroDoc  what `retro.json` holds
 */

/**
 * `retro.json`'s content with `record` in it: a replay replaces the record of the same feature PR and
 * run, anything else is added. A file that is not the retro's JSON is started again.
 * @param {string | null} existing  the file's text on the retro branch, or `null`
 * @param {RunRecord} record
 * @returns {RetroDoc}
 */
export function mergeRuns(existing, record) {
  let doc = null;
  try {
    doc = existing ? JSON.parse(existing) : null;
  } catch {
    doc = null;
  }
  const runs = Array.isArray(doc?.runs) ? doc.runs : [];
  const same = (run) => run.featurePr?.number === record.featurePr.number && run.run === record.run;
  const index = runs.findIndex(same);
  const next = index === -1 ? [...runs, record] : runs.map((run, i) => (i === index ? record : run));
  return { prd: record.prd.number, runs: next };
}

/** The retro PR's title: `docs(retro): PRD <n> — <PRD title>`. */
export function retroTitle(prd) {
  return `docs(retro): PRD ${prd.number} — ${prd.title}`;
}

/**
 * @param {{ doc: RetroDoc, featurePr: number, prose?: object | null, kinds?: readonly object[] }} input
 * @returns {{ markdown: string, json: string, title: string, prBody: string }}
 */
export function render({ doc, featurePr, prose = null, kinds = KINDS }) {
  const runs = doc.runs.filter((run) => run.featurePr.number === featurePr);
  if (runs.length === 0) throw new Error(`render: retro.json holds no run of #${featurePr}.`);
  const latest = runs.at(-1);
  const findings = uniqueFindings(runs);
  const issues = Object.assign({}, ...runs.map((run) => run.issues ?? {}));

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
    '## Findings',
    '',
    ...(findings.length === 0
      ? ['None: nothing crossed a threshold of the rules.', '']
      : findings.flatMap((finding) => findingBlock(finding, prose, issues))),
    '## Proposed lessons',
    '',
    ...lessons(prose, findings),
    '',
  ];

  const byRun = (run) => kinds.filter((kind) => kind.runs.includes(run));
  const sectionOf = (kind) => kindSection(kind, runs, findings, prose, issues);
  lines.push(...byRun('merge').flatMap(sectionOf));
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
function uniqueFindings(runs) {
  const seen = new Set();
  return runs.flatMap((run) => run.findings).filter((finding) => !seen.has(finding.id) && seen.add(finding.id));
}

/** A prose field as written: its text, the line naming why it was dropped, or `null` when not given. */
function field(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && 'dropped' in value) return `_Dropped: ${value.dropped}._`;
  return String(value);
}

function summary(prose, latest) {
  const text = field(prose?.summary);
  if (text) return text;
  return `Facts only: ${latest.narration?.reason ?? 'no prose'}`;
}

/** A finding's title: the model's when it gave one and it was kept, else the detector's own. */
function titleOf(finding, prose) {
  const given = prose?.findings?.[finding.id]?.title;
  return typeof given === 'string' && given ? given : finding.title;
}

function issueLink(issue) {
  if (!issue) return null;
  return `[#${issue.number}](${issue.url})${issue.state === 'closed' ? ' (closed)' : ''}`;
}

function findingBlock(finding, prose, issues) {
  const words = prose?.findings?.[finding.id] ?? {};
  const issue = issueLink(issues[finding.id]);
  const droppedTitle = typeof words.title === 'object' && words.title !== null ? field(words.title) : null;
  const heading = [`### ${finding.ref} · ${titleOf(finding, prose)} — \`${finding.id}\``, issue].filter(Boolean).join(' · ');
  const lines = [heading, ''];
  if (droppedTitle) lines.push(`- **Title:** ${droppedTitle}`);
  lines.push(`- **What happened:** ${finding.happened}`);
  const why = field(words.whyItMatters);
  if (why) lines.push(`- **Why it matters:** ${why}`);
  const lesson = field(words.lesson);
  if (lesson) lines.push(`- **Proposed lesson:** ${lesson}`);
  if (words.keep === true) lines.push(`- **Kept:** ${typeof words.why === 'string' && words.why ? words.why : 'yes'}`);
  const evidence = (finding.evidence ?? []).map((item) => `[${item.label}](${item.url})`);
  lines.push(`- **Evidence:** ${evidence.length > 0 ? evidence.join(', ') : 'none recorded'}`, '');
  return lines;
}

function lessons(prose, findings) {
  const given = (prose?.lessons ?? []).filter((lesson) => typeof lesson?.text === 'string' && lesson.text);
  if (given.length === 0) return [prose ? 'None proposed.' : 'None proposed: facts only.'];
  const refOf = new Map(findings.map((finding) => [finding.id, finding.ref]));
  return given.map((lesson) => {
    const refs = (lesson.findings ?? []).map((id) => refOf.get(id)).filter(Boolean);
    return refs.length > 0 ? `- ${lesson.text} (${refs.join(', ')})` : `- ${lesson.text}`;
  });
}

/** One kind's section: its own lines from the latest run that has its facts, then its findings. */
function kindSection(kind, runs, findings, prose, issues) {
  const facts = [...runs].reverse().map((run) => run.kinds?.[kind.id]).find((value) => value !== null && value !== undefined) ?? null;
  const own = findings.filter((finding) => finding.source === kind.id);
  const described = facts === null ? null : kind.describe(facts);
  if ((!described || described.length === 0) && own.length === 0) return [];
  const lines = [`## ${kind.section}`, ''];
  if (described && described.length > 0) lines.push(...described, '');
  if (own.length > 0) {
    const refs = own.map((finding) => [`${finding.ref} · ${titleOf(finding, prose)}`, issueLink(issues[finding.id])].filter(Boolean).join(' · '));
    lines.push(`Findings: ${refs.join('; ')}`, '');
  }
  return lines;
}

function rulesSection(rules) {
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

function prBody(latest, findings, prose, issues) {
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
 * @param {{ judged: boolean, reason: string, runs: RunRecord[], prose?: object | null }} input
 * @returns {string}
 */
export function verdictComment({ judged, reason, runs, prose = null }) {
  const first = runs[0];
  const findings = uniqueFindings(runs);
  const timeline = runs.map((run) => run.kinds?.timeline).find((facts) => facts) ?? null;
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

function minutesBetween(from, to) {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) ? Math.round(ms / 60000) : null;
}

function oneLine(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim() || 'no reason given';
}
