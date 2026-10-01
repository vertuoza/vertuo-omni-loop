// @ts-nocheck
// The retro issues (PRD 72, decision 4): one issue per finding the judge kept (PRD 487), worst
// first, at most `ISSUES_PER_RUN` per run; a finding not kept, or a retro not judged, opens none.
// Each is labelled `labels.retro` and never `labels.prd`, its body ending with the YAML block
// `/omni:retro-apply` reads.
//
// Idempotent, so a replay or a retry after a half-done step completes it rather than duplicating it:
// each issue is found again by its marker (`<!-- <markers.prefix>-retro: prd=<n> finding=<id> -->`)
// among the issues carrying the retro label. An open one is rewritten in place when its title or body
// changed; a closed one is left closed and untouched, and is still given back for `retro.md` to link.
//
// The contract the function and `render` rely on:
//   in:  octokit, { owner, repo, config, sheet, prose, retroPath }
//   out: { [findingId]: { number, url, state: 'open' | 'closed' } } for each finding with an issue.
//   It runs in the step before the branch, the files and the pull request are published, so
//   `retro.md` can link each issue. On the first run the retro PR is not open yet, so the header
//   names it only once one is open from the retro branch (a replay, or a later run).
import { PER_PAGE, paginate } from './github.ts';
import { ISSUES_PER_RUN } from './rules.ts';

/**
 * @typedef {{ number: number, url: string, state: 'open' | 'closed' }} IssueLink
 */

/**
 * @param {{ request: Function }} octokit
 * @param {{ owner: string, repo: string, config: object, sheet: object, prose: object | null, retroPath: string }} input
 * @returns {Promise<Record<string, IssueLink>>}
 */
export async function publishIssues(octokit, { owner, repo, config, sheet, prose, retroPath }) {
  const chosen = sheet.findings.filter((finding) => isKept(prose, finding.id)).slice(0, ISSUES_PER_RUN);
  if (chosen.length === 0) return {};

  const label = config.labels.retro;
  if (label === config.labels.prd) {
    throw new Error(`The retro label \`${label}\` is the PRD label; refusing to open a retro issue as a PRD.`);
  }
  const prefix = config.markers.prefix;
  const existing = await listLabelled(octokit, { owner, repo, label });
  const retroPr = await findRetroPull(octokit, { owner, repo, branch: config.branches.retro.replaceAll('{topic}', sheet.prd.topic) });

  const links = {};
  for (const finding of chosen) {
    const { title, body } = renderIssue({ sheet, finding, prose, retroPath, retroPr, prefix });
    const marker = issueMarker(prefix, sheet.prd.number, finding.id);
    const found = pick(existing.filter((issue) => (issue.body ?? '').includes(marker)));

    if (found?.state === 'closed') {
      links[finding.id] = { number: found.number, url: found.html_url, state: 'closed' };
      continue;
    }
    if (found) {
      if (found.title !== title || found.body !== body) {
        await octokit.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
          owner,
          repo,
          issue_number: found.number,
          title,
          body,
        });
      }
      links[finding.id] = { number: found.number, url: found.html_url, state: 'open' };
      continue;
    }
    const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues', { owner, repo, title, body, labels: [label] });
    links[finding.id] = { number: data.number, url: data.html_url, state: 'open' };
  }
  return links;
}

/** Whether the judge kept the finding `id`: only a verdict `guard` accepted carries a `keep`. */
export function isKept(prose, id) {
  return prose?.findings?.[id]?.keep === true;
}

/**
 * The marker a retro issue's body starts with, which finds it again: one HTML comment, whatever the
 * finding id holds.
 */
export function issueMarker(prefix, prd, findingId) {
  const id = String(findingId).replace(/\s+/g, ' ').replaceAll('-->', '--&gt;');
  return `<!-- ${prefix}-retro: prd=${prd} finding=${id} -->`;
}

/**
 * One finding's issue: its title and its body. Pure. The words around the facts are the prose `guard`
 * accepted; with none, each says so.
 * @param {{ sheet: object, finding: object, prose: object | null, retroPath: string,
 *   retroPr: { number: number } | null, prefix: string }} input
 * @returns {{ title: string, body: string }}
 */
export function renderIssue({ sheet, finding, prose, retroPath, retroPr, prefix }) {
  const prd = sheet.prd.number;
  const words = prose?.findings?.[finding.id] ?? {};
  const refs = [`#${prd}`, `feature PR #${sheet.featurePr.number}`, retroPr ? `retro PR #${retroPr.number}` : null].filter(Boolean);
  const evidence = finding.evidence ?? [];

  const lines = [
    issueMarker(prefix, prd, finding.id),
    `**Retro of PRD ${prd}** (${refs.join(' · ')}) · ${finding.ref}`,
    '',
    '## What happened',
    '',
    finding.happened,
    '',
    '## Why it matters',
    '',
    field(words.whyItMatters) ?? (prose ? 'Not written.' : 'Not written: facts only.'),
    '',
    '## Proposed lesson',
    '',
    lessonOf(finding, words, prose),
    '',
    ...(words.keep === true && typeof words.why === 'string' && words.why ? ['## Why it is kept', '', words.why, ''] : []),
    '## Evidence',
    '',
    ...(evidence.length > 0 ? evidence.map((item) => `- [${item.label}](${item.url})`) : ['None recorded.']),
    '',
    '```yaml',
    `prd: ${prd}`,
    `finding: ${scalar(finding.id)}`,
    `kind: ${scalar(finding.kind)}`,
    `retro: ${scalar(retroPath)}`,
    `evidence: [${evidence.map((item) => scalar(item.url)).join(', ')}]`,
    '```',
  ];
  return { title: `retro(PRD ${prd}): ${titleOf(finding, words)}`, body: `${lines.join('\n')}\n` };
}

/** The finding's own lesson, then the lessons citing it; or a line saying there is none. */
function lessonOf(finding, words, prose) {
  const own = field(words.lesson);
  const cited = (prose?.lessons ?? [])
    .filter((lesson) => typeof lesson?.text === 'string' && lesson.text && (lesson.findings ?? []).includes(finding.id))
    .map((lesson) => `- ${lesson.text}`);
  const parts = [own, cited.length > 0 ? cited.join('\n') : null].filter(Boolean);
  if (parts.length > 0) return parts.join('\n\n');
  return prose ? 'None proposed.' : 'None proposed: facts only.';
}

/** A finding's title: the model's when it gave one and it was kept, else the detector's own. */
function titleOf(finding, words) {
  return typeof words.title === 'string' && words.title ? words.title : finding.title;
}

/** A prose field as written: its text, the line naming why it was dropped, or `null` when not given. */
function field(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'object' && 'dropped' in value) return `_Dropped: ${value.dropped}._`;
  return String(value);
}

const PLAIN = /^[A-Za-z0-9_./][A-Za-z0-9_./~+=%@-]*(?::[A-Za-z0-9_./~+=%@-]+)*$/;
const RESERVED = /^(?:true|false|yes|no|on|off|null|[-+]?\.?\d|\.inf|\.nan)/i;

/** A YAML scalar: plain when it reads back as the same string in a block or a flow list, else quoted. */
function scalar(value) {
  const text = String(value);
  return PLAIN.test(text) && !RESERVED.test(text) ? text : JSON.stringify(text);
}

/** Every issue carrying `label`, open or closed; pull requests left out. */
async function listLabelled(octokit, { owner, repo, label }) {
  const items = await paginate((page) =>
    octokit
      .request('GET /repos/{owner}/{repo}/issues', { owner, repo, labels: label, state: 'all', per_page: PER_PAGE, page })
      .then(({ data }) => data),
  );
  return items.filter((item) => !item.pull_request);
}

/** Of the issues carrying one marker, the open one first, then the oldest. */
function pick(issues) {
  return [...issues].sort((a, b) => (a.state === 'open' ? 0 : 1) - (b.state === 'open' ? 0 : 1) || a.number - b.number)[0] ?? null;
}

/** The retro PR from the retro branch: the open one, else the latest; `null` before the first is opened. */
async function findRetroPull(octokit, { owner, repo, branch }) {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: 'all',
    per_page: 10,
    page: 1,
  });
  const pulls = [...data].sort((a, b) => b.number - a.number);
  const pull = pulls.find((candidate) => candidate.state === 'open') ?? pulls[0];
  return pull ? { number: pull.number, url: pull.html_url } : null;
}
