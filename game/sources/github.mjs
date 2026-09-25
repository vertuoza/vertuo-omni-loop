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
//
// Spec §8: a malformed inbox or outbox file is ignored (never crashes the projector), and a source
// that cannot be read reads as empty. Fleets are not read here: the roster (login → fleet) comes
// from Supabase with the config, and that read is hard (F7, sources/supabase.mjs). Every
// timestamp passes through `toIso` (F4); a record whose required time is unreadable is skipped.
// Beyond the list reads, each zone's sub-PR timeline gives the `omni:needs-fix` history (F1) and each
// closed bug's closing PRs say whether a merged fix closed it (F5c); both soft. An inbox file whose `prd` doesn't parse as an integer never
// reaches `inboxByPrd`; an open outbox item missing an `id` or carrying a rank outside
// {medium, high, human-action} is skipped rather than pushed. The inbox `surveyedAt` commits read is
// wrapped in `soft()`; when it yields nothing, the region falls back to the PRD issue's `createdAt`
// so `surveyedAt` is always a valid ISO string.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseInbox, parseOutboxItem, parseSettled, parsePlanSlices } from './parsers.mjs';

const run = promisify(execFile);
export const ghExec = async (args) => (await run('gh', args, { maxBuffer: 64 * 1024 * 1024 })).stdout;

const RAW = ['-H', 'Accept: application/vnd.github.raw'];
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const json = (s) => (s.trim() ? JSON.parse(s) : []);
const soft = (p) => p.catch(() => ''); // a 404 (no outbox dir yet, no plan yet) is an empty read
const OUTBOX_RANKS = new Set(['medium', 'high', 'human-action']); // spec §8: a malformed outbox file is ignored

// F4: every timestamp read from GitHub or a delivery file goes through here, so one malformed value
// never reaches the projector as a crash. Empty, missing, jq's "null" and unparseable → null; anything
// else → UTC ISO without milliseconds (`2026-09-22T10:00:00Z`). A date-only value is UTC midnight.
export function toIso(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === 'null') return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
const firstIso = (out) => toIso(lines(out)[0]);

export async function buildSnapshot({ config, exec = ghExec, now = new Date(), org = 'vertuoza', planRepo = 'vertuo-omni-plan', prds }) {
  const issues = json(await exec(['issue', 'list', '-R', `${org}/${planRepo}`, '--label', 'omni:prd', '--state', 'all', '--limit', '500', '--json', 'number,title,assignees,createdAt,closedAt']));

  // The roster (GitHub login, lower-cased → fleet) is the arcade's: players pick their fleet there.
  const teams = { ...(config.roster ?? {}) };

  const inboxByPrd = new Map(); // prd → [{ repo, file, inbox, surveyedAt }]
  for (const repo of config.repos) {
    const files = lines(await soft(exec(['api', `repos/${org}/${repo}/contents/docs/inbox`, '--jq', '.[].name']))).filter((f) => f !== 'README.md' && f.endsWith('.md'));
    for (const file of files) {
      const inbox = parseInbox(await exec(['api', `repos/${org}/${repo}/contents/docs/inbox/${file}`, ...RAW]));
      if (!Number.isInteger(inbox.prd)) continue; // spec §8: a malformed inbox file (no front matter, no prd) is ignored
      // A source that cannot be read reads as empty (spec §8): a failed commits lookup leaves
      // surveyedAt null here; the planet loop below falls back to the PRD issue's createdAt.
      const surveyedAt = firstIso(await soft(exec(['api', `repos/${org}/${repo}/commits?path=docs/inbox/${file}&per_page=100`, '--jq', '.[-1].commit.committer.date'])));
      (inboxByPrd.get(inbox.prd) ?? inboxByPrd.set(inbox.prd, []).get(inbox.prd)).push({ repo, file, inbox, surveyedAt });
    }
  }

  // A single-planet read (game:banner <prd>) must not pay for the whole org: when `prds` is given,
  // keep only those issues plus whatever their inbox files name as a blocker (one level is enough —
  // the banner only needs to know a region is locked, not to walk the whole blocker chain). The
  // per-repo inbox listing above stays unfiltered: it is what reveals the blockers in the first place.
  let wantedIssues = issues;
  if (prds) {
    const wanted = new Set(prds);
    for (const prd of prds) {
      for (const { inbox } of inboxByPrd.get(prd) ?? []) {
        for (const blocker of inbox.blockedBy) wanted.add(blocker);
      }
    }
    wantedIssues = issues.filter((issue) => wanted.has(issue.number));
  }

  const planets = [];
  for (const issue of wantedIssues) {
    const createdAt = toIso(issue.createdAt);
    if (!createdAt) continue; // F4: a planet cannot be charted without its birth time
    const captain = issue.assignees?.[0]?.login ?? null;
    const planet = {
      prd: issue.number, title: issue.title, captain, ownerTeam: captain ? teams[captain.toLowerCase()] ?? null : null,
      issue: { createdAt, closedAt: toIso(issue.closedAt) },
      regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
    };
    const planned = new Set(); // repos whose inbox names a plan: the regions a terraform waits for (F3)
    for (const { repo, inbox, surveyedAt } of inboxByPrd.get(issue.number) ?? []) {
      const region = { repo, blockedBy: inbox.blockedBy, surveyedAt: surveyedAt ?? createdAt, featurePr: null };
      planet.regions.push(region);
      if (inbox.plan) planned.add(repo);
      const prs = json(await exec(['pr', 'list', '-R', `${org}/${repo}`, '--search', `"Closes #${issue.number}" in:body`, '--base', 'main', '--state', 'all', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt']));
      const fp = prs.filter((pr) => toIso(pr.createdAt)).sort((a, b) => a.number - b.number)[0]; // F4: no creation time, no feature PR
      if (!fp) continue;
      const fpCreatedAt = toIso(fp.createdAt);
      const readyAt = fp.isDraft ? null : (firstIso(await soft(exec(['api', `repos/${org}/${repo}/issues/${fp.number}/timeline`, '--paginate', '--jq', '[.[] | select(.event=="ready_for_review")][0].created_at']))) ?? fpCreatedAt);
      region.featurePr = { repo, number: fp.number, createdAt: fpCreatedAt, readyAt, mergedAt: toIso(fp.mergedAt), lastActivityAt: toIso(fp.updatedAt) ?? fpCreatedAt };

      const slices = inbox.plan ? parsePlanSlices(await soft(exec(['api', `repos/${org}/${repo}/contents/${inbox.plan}?ref=${fp.headRefName}`, ...RAW]))) : [];
      // --json includes `body` (beyond the reads list's bare field set) because the revert rule
      // below — "a sub-PR titled Revert whose body names #<n>" — cannot be read without it.
      const subs = json(await exec(['pr', 'list', '-R', `${org}/${repo}`, '--base', fp.headRefName, '--state', 'all', '--label', 'omni:sub', '--limit', '200', '--json', 'number,title,headRefName,author,createdAt,labels,mergedAt,body,state']))
        .map((x) => ({ ...x, createdAt: toIso(x.createdAt), mergedAt: toIso(x.mergedAt) }))
        .filter((x) => x.createdAt); // F4: a sub-PR without a creation time is unreadable, not a claim
      const reverts = new Map(subs.filter((s) => /^revert/i.test(s.title) && s.mergedAt).flatMap((s) => [...(s.body ?? '').matchAll(/#(\d+)/g)].map((m) => [Number(m[1]), s.mergedAt])));
      for (const slice of slices) {
        const sub = zoneSub(subs, slice.id, reverts);
        const labels = sub ? sub.labels.map((l) => l.name) : [];
        planet.zones.push({
          id: slice.id, repo, wave: slice.wave, blockedBy: slice.blockedBy,
          pr: sub ? {
            number: sub.number, author: sub.author?.login ?? null, createdAt: sub.createdAt, labels, mergedAt: sub.mergedAt, revertedAt: reverts.get(sub.number) ?? null,
            needsFix: await needsFixHistory(exec, `${org}/${repo}`, sub, labels),
          } : null,
        });
      }

      const dir = `docs/outbox/${issue.number}`;
      const names = lines(await soft(exec(['api', `repos/${org}/${repo}/contents/${dir}?ref=${fp.headRefName}`, '--jq', '.[].name'])));
      const settled = names.includes('settled.md') ? parseSettled(await exec(['api', `repos/${org}/${repo}/contents/${dir}/settled.md?ref=${fp.headRefName}`, ...RAW])) : new Map();
      for (const name of names.filter((n) => n.endsWith('.md') && n !== 'settled.md')) {
        const item = parseOutboxItem(await exec(['api', `repos/${org}/${repo}/contents/${dir}/${name}?ref=${fp.headRefName}`, ...RAW]));
        if (!item.id || !OUTBOX_RANKS.has(item.rank)) continue; // spec §8: a malformed outbox file (no front matter) is ignored
        // F4: first commit, else the `raised` date at 07:00Z, else the item is skipped.
        const raisedAt = firstIso(await soft(exec(['api', `repos/${org}/${repo}/commits?path=${dir}/${name}&sha=${fp.headRefName}&per_page=100`, '--jq', '.[-1].commit.committer.date'])))
          ?? (/^\d{4}-\d{2}-\d{2}$/.test(item.raised ?? '') ? toIso(`${item.raised}T07:00:00Z`) : null);
        if (!raisedAt) continue;
        planet.outbox.push({ id: item.id, repo, rank: item.rank, raisedAt, settled: null });
      }
      for (const [id, s] of settled) {
        const at = toIso(s.at);
        if (!at) continue; // F4: a settle without a readable `Approved at` is skipped
        // F6: the rework sub-PR's author is who closes the fault line a drift opened.
        const rework = s.verdict === 'drifted' ? subs.find((x) => x.mergedAt && new RegExp(`\\b${id}\\b`).test(x.body ?? '')) : null;
        planet.outbox.push({ id, repo, rank: s.rank ?? 'medium', raisedAt: at, settled: { verdict: s.verdict, at, by: s.by, reworkMergedAt: rework?.mergedAt ?? null, reworkBy: rework?.author?.login ?? null } });
      }

      const bugs = json(await soft(exec(['issue', 'list', '-R', `${org}/${repo}`, '--label', 'bug', '--state', 'all', '--search', `#${issue.number}`, '--json', 'number,createdAt,closedAt,closedBy'])));
      for (const b of bugs) {
        const bugCreatedAt = toIso(b.createdAt);
        if (!bugCreatedAt) continue;
        const bugClosedAt = toIso(b.closedAt);
        const fixedBy = bugClosedAt ? await bugFixedBy(exec, org, repo, b.number) : null;
        planet.bugs.push({ repo, number: b.number, createdAt: bugCreatedAt, closedAt: bugClosedAt, closedBy: b.closedBy?.login ?? null, fixedBy });
      }
    }
    planet.featurePr = aggregateFeaturePr(planet.regions, planned);
    planets.push(planet);
  }
  return { at: now.toISOString(), teams, planets };
}

// F3: the planet's feature PR, aggregated over its regions (same shape as a region's, so every
// consumer of `planet.featurePr` reads it unchanged). null when no region has one; `createdAt` the
// earliest; `readyAt` / `mergedAt` the latest, and only once every region that has a plan (or, when
// no inbox names a plan, every region with a feature PR) is ready / merged; `repo`/`number` are the
// first region's. A planet is therefore terraformed at its last region's merge, not its first.
function aggregateFeaturePr(regions, planned) {
  const fps = regions.map((r) => r.featurePr).filter(Boolean);
  if (!fps.length) return null;
  const required = planned.size ? regions.filter((r) => planned.has(r.repo)).map((r) => r.featurePr) : fps;
  const latest = (field) => (required.every((fp) => fp?.[field]) ? required.map((fp) => fp[field]).sort().at(-1) : null);
  return {
    repo: fps[0].repo, number: fps[0].number,
    createdAt: fps.map((fp) => fp.createdAt).sort()[0],
    readyAt: latest('readyAt'), mergedAt: latest('mergedAt'),
    lastActivityAt: fps.map((fp) => fp.lastActivityAt).filter(Boolean).sort().at(-1) ?? null,
  };
}

// F5c: who fixed a closed bug — the author of the earliest-merged PR among those that closed it
// (`closedByPullRequestsReferences`, then one `gh pr view` per reference for `mergedAt`/`author`,
// which the reference itself does not carry). null when no referenced PR merged: a bug closed by
// hand is not a fix, and its aftershock keeps decaying. Where the gh in use does not know
// `closedByPullRequestsReferences`, the timeline's last `closed` event stands in: a closing commit
// (`commit_id`) counts as a fix by that event's actor; anything unknown is not fixed. All soft.
async function bugFixedBy(exec, org, repo, number) {
  let refs = null;
  try {
    refs = JSON.parse(await exec(['issue', 'view', String(number), '-R', `${org}/${repo}`, '--json', 'closedByPullRequestsReferences'])).closedByPullRequestsReferences;
  } catch {
    refs = null;
  }
  if (Array.isArray(refs)) {
    const merged = [];
    for (const ref of refs) {
      const slug = ref.repository?.name ? `${ref.repository.owner?.login ?? org}/${ref.repository.name}` : `${org}/${repo}`;
      let pr = {};
      try { pr = JSON.parse(await exec(['pr', 'view', String(ref.number), '-R', slug, '--json', 'mergedAt,author'])); } catch { pr = {}; }
      const mergedAt = toIso(pr?.mergedAt);
      if (mergedAt && pr.author?.login) merged.push({ mergedAt, by: pr.author.login });
    }
    return merged.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))[0]?.by ?? null;
  }
  const closed = lines(await soft(exec(['api', `repos/${org}/${repo}/issues/${number}/timeline`, '--paginate', '--jq', '.[] | select(.event=="closed") | "\\(.commit_id) \\(.actor.login)"']))).at(-1);
  const [commitId, actor] = (closed ?? '').split(/\s+/);
  return commitId && commitId !== 'null' && actor && actor !== 'null' ? actor : null;
}

// F2: the sub-PR that stands for a zone. A sub-PR closed without merging is dropped (it freed the
// zone); among the rest the lowest number wins (spec §8). Once that one is reverted, the zone's next
// non-revert sub-PR opened after the revert — if there is one — takes over.
function zoneSub(subs, sliceId, reverts) {
  const live = subs
    .filter((s) => !/^revert/i.test(s.title) && s.headRefName.endsWith(`--${sliceId}`) && !(s.state === 'CLOSED' && !s.mergedAt))
    .sort((a, b) => a.number - b.number);
  let sub = live[0];
  for (let revertedAt = sub && reverts.get(sub.number); revertedAt; revertedAt = reverts.get(sub.number)) {
    const next = live.find((s) => s.number > sub.number && new Date(s.createdAt) > new Date(revertedAt));
    if (!next) break;
    sub = next;
  }
  return sub;
}

// F1: when `omni:needs-fix` was put on and taken off a sub-PR. The snapshot is a point in time, so the
// label's history comes off the issue timeline (soft). `{ labeledAt, unlabeledAt }` — unlabeledAt is
// null while the label is still on; the whole value is null when the sub-PR was never labelled. A
// failed read of a currently-labelled sub-PR falls back to "labelled since the sub-PR was opened".
const NEEDS_FIX_JQ = '.[] | select((.event=="labeled" or .event=="unlabeled") and .label.name=="omni:needs-fix") | "\\(.event) \\(.created_at)"';
async function needsFixHistory(exec, repoSlug, sub, labels) {
  const history = lines(await soft(exec(['api', `repos/${repoSlug}/issues/${sub.number}/timeline`, '--paginate', '--jq', NEEDS_FIX_JQ])))
    .map((l) => l.split(/\s+/)).map(([event, at]) => [event, toIso(at)]).filter(([event, at]) => (event === 'labeled' || event === 'unlabeled') && at);
  const labelled = labels.includes('omni:needs-fix');
  const firstLabel = history.find(([event]) => event === 'labeled')?.[1] ?? null;
  if (!firstLabel) return labelled ? { labeledAt: sub.createdAt, unlabeledAt: null } : null;
  const last = history.at(-1);
  return { labeledAt: firstLabel, unlabeledAt: !labelled && last[0] === 'unlabeled' ? last[1] : null };
}
