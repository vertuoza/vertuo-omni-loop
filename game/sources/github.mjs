// The one impure module: builds a world snapshot from GitHub through the gh CLI (spec §7.3).
// Every call goes through `exec` so tests run on fixtures. Reads only — no `gh pr edit`, no
// `gh issue comment`, no POST of any kind.
//
// Two known simplifications, both documented here rather than silently baked in:
//   - `surveyedAt` / an open outbox item's `raisedAt` (its "first commit" date) reads
//     `.[-1].commit.committer.date` off the first page of `gh api .../commits`, which the GitHub
//     API returns newest-first. That is the OLDEST commit *of the first page*, not of the file's
//     whole history — exact whenever the file has a single commit (the common case: an inbox or
//     outbox file is written once), an underestimate of the file's age otherwise.
//   - A settled outbox item's `raisedAt` is taken as its settle time (`- Approved at:`), because
//     the open file is deleted once settled, so its first-commit date is no longer reachable from
//     the feature branch. Decay for a settled item is therefore zero, which under-counts a slow
//     answer that was eventually given. The open-item path above is exact; only this settled path
//     approximates.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseInbox, parseOutboxItem, parseSettled, parsePlanSlices } from './parsers.mjs';

const run = promisify(execFile);
export const ghExec = async (args) => (await run('gh', args, { maxBuffer: 64 * 1024 * 1024 })).stdout;

const RAW = ['-H', 'Accept: application/vnd.github.raw'];
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const json = (s) => (s.trim() ? JSON.parse(s) : []);
const soft = (p) => p.catch(() => ''); // a 404 (no outbox dir yet, no plan yet) is an empty read

export async function buildSnapshot({ config, exec = ghExec, now = new Date(), org = 'vertuoza', planRepo = 'vertuo-omni-plan' }) {
  const issues = json(await exec(['issue', 'list', '-R', `${org}/${planRepo}`, '--label', 'prd', '--state', 'all', '--limit', '500', '--json', 'number,title,assignees,createdAt,closedAt']));

  const teams = {};
  for (const team of Object.keys(config.teams)) {
    for (const login of lines(await soft(exec(['api', `orgs/${org}/teams/${team}/members`, '--paginate', '--jq', '.[].login'])))) teams[login] = team;
  }

  const inboxByPrd = new Map(); // prd → [{ repo, file, inbox, surveyedAt }]
  for (const repo of config.repos) {
    const files = lines(await soft(exec(['api', `repos/${org}/${repo}/contents/docs/inbox`, '--jq', '.[].name']))).filter((f) => f !== 'README.md' && f.endsWith('.md'));
    for (const file of files) {
      const inbox = parseInbox(await exec(['api', `repos/${org}/${repo}/contents/docs/inbox/${file}`, ...RAW]));
      const surveyedAt = lines(await exec(['api', `repos/${org}/${repo}/commits?path=docs/inbox/${file}&per_page=100`, '--jq', '.[-1].commit.committer.date']))[0] ?? null;
      (inboxByPrd.get(inbox.prd) ?? inboxByPrd.set(inbox.prd, []).get(inbox.prd)).push({ repo, file, inbox, surveyedAt });
    }
  }

  const planets = [];
  for (const issue of issues) {
    const captain = issue.assignees?.[0]?.login ?? null;
    const planet = {
      prd: issue.number, title: issue.title, captain, ownerTeam: captain ? teams[captain] ?? null : null,
      issue: { createdAt: issue.createdAt, closedAt: issue.closedAt ?? null },
      regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
    };
    for (const { repo, inbox, surveyedAt } of inboxByPrd.get(issue.number) ?? []) {
      planet.regions.push({ repo, blockedBy: inbox.blockedBy, surveyedAt });
      const prs = json(await exec(['pr', 'list', '-R', `${org}/${repo}`, '--search', `"Closes #${issue.number}" in:body`, '--base', 'main', '--state', 'all', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt']));
      const fp = prs.sort((a, b) => a.number - b.number)[0];
      if (!fp) continue;
      const readyAt = fp.isDraft ? null : (lines(await soft(exec(['api', `repos/${org}/${repo}/issues/${fp.number}/timeline`, '--paginate', '--jq', '[.[] | select(.event=="ready_for_review")][0].created_at'])))[0] ?? fp.createdAt);
      planet.featurePr ??= { repo, number: fp.number, createdAt: fp.createdAt, readyAt, mergedAt: fp.mergedAt ?? null, lastActivityAt: fp.updatedAt };

      const slices = inbox.plan ? parsePlanSlices(await soft(exec(['api', `repos/${org}/${repo}/contents/${inbox.plan}?ref=${fp.headRefName}`, ...RAW]))) : [];
      // --json includes `body` (beyond the reads list's bare field set) because the revert rule
      // below — "a sub-PR titled Revert whose body names #<n>" — cannot be read without it.
      const subs = json(await exec(['pr', 'list', '-R', `${org}/${repo}`, '--base', fp.headRefName, '--state', 'all', '--label', 'pr:sub', '--limit', '200', '--json', 'number,title,headRefName,author,createdAt,labels,mergedAt,body']));
      const reverts = new Map(subs.filter((s) => /^revert/i.test(s.title) && s.mergedAt).flatMap((s) => [...(s.body ?? '').matchAll(/#(\d+)/g)].map((m) => [Number(m[1]), s.mergedAt])));
      for (const slice of slices) {
        const sub = subs.filter((s) => !/^revert/i.test(s.title) && s.headRefName.endsWith(`--${slice.id}`)).sort((a, b) => a.number - b.number)[0];
        planet.zones.push({
          id: slice.id, repo, wave: slice.wave, blockedBy: slice.blockedBy,
          pr: sub ? { number: sub.number, author: sub.author?.login ?? null, createdAt: sub.createdAt, labels: sub.labels.map((l) => l.name), mergedAt: sub.mergedAt ?? null, revertedAt: reverts.get(sub.number) ?? null } : null,
        });
      }

      const dir = `docs/outbox/${issue.number}`;
      const names = lines(await soft(exec(['api', `repos/${org}/${repo}/contents/${dir}?ref=${fp.headRefName}`, '--jq', '.[].name'])));
      const settled = names.includes('settled.md') ? parseSettled(await exec(['api', `repos/${org}/${repo}/contents/${dir}/settled.md?ref=${fp.headRefName}`, ...RAW])) : new Map();
      for (const name of names.filter((n) => n.endsWith('.md') && n !== 'settled.md')) {
        const item = parseOutboxItem(await exec(['api', `repos/${org}/${repo}/contents/${dir}/${name}?ref=${fp.headRefName}`, ...RAW]));
        const raisedAt = lines(await soft(exec(['api', `repos/${org}/${repo}/commits?path=${dir}/${name}&sha=${fp.headRefName}&per_page=100`, '--jq', '.[-1].commit.committer.date'])))[0] ?? `${item.raised}T07:00:00Z`;
        planet.outbox.push({ id: item.id, repo, rank: item.rank, raisedAt, settled: null });
      }
      for (const [id, s] of settled) {
        const rework = s.verdict === 'drifted' ? subs.find((x) => x.mergedAt && new RegExp(`\\b${id}\\b`).test(x.body ?? ''))?.mergedAt ?? null : null;
        planet.outbox.push({ id, repo, rank: s.rank ?? 'medium', raisedAt: s.at, settled: { verdict: s.verdict, at: s.at, by: s.by, reworkMergedAt: rework } });
      }

      const bugs = json(await soft(exec(['issue', 'list', '-R', `${org}/${repo}`, '--label', 'bug', '--state', 'all', '--search', `#${issue.number}`, '--json', 'number,createdAt,closedAt,closedBy'])));
      for (const b of bugs) planet.bugs.push({ repo, number: b.number, createdAt: b.createdAt, closedAt: b.closedAt ?? null, closedBy: b.closedBy?.login ?? null });
    }
    planets.push(planet);
  }
  return { at: now.toISOString(), teams, planets };
}
