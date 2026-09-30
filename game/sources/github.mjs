// The one impure module: builds a world snapshot from GitHub through the gh CLI (spec §7.3).
// Every call goes through `exec` so tests run on fixtures. Reads only — no `gh pr edit`, no
// `gh issue comment`, no POST of any kind.
//
// What it reads (PRD 728): the workspace's tracked repositories (`config.tracked`, owner/name, from
// public.repositories; an untracked or absent repository is not read). Each one's `omni:prd` issues
// are its PRDs: a PRD's **home** is the repository of its issue, and its planet is keyed
// `<home>#<n>`, so two repositories' PRD 88 are two planets. A PRD's work is read from its folder in
// the kit layout, `<delivery>/{inbox,shipped}/<nnnn>-<topic>/` (the delivery path from the
// repository's `.omni-loop/config.yml`, as game/dossiers/folders.mjs mirrors it): `spec.md` for
// `blocked-by`, `plan.md` for the slices, and the outbox (`<delivery>/outbox/<nnnn>-<topic>/` while
// it is built, `<folder>/outbox/` once shipped) for the items and `settled.md`. Its feature PR is a PR
// of its home into the default branch whose body says `Closes #<n>`, the one labelled `omni:feature`
// when one is. The owner is the first assignee, else the issue's author. A multi-repository PRD (its
// plan's slice table has a `repo` column) has one more region per tracked repository holding a feature
// PR into its default branch whose body starts `Part of <owner>/<home>#<n>`; its sub-PRs secure that
// region's slices, and the planet terraforms once every region's feature PR has merged.
//
// Two known simplifications, both documented here rather than silently baked in:
//   - `surveyedAt` / an open outbox item's `raisedAt` (its "first commit" date) reads
//     `.[-1].commit.committer.date` off the first page of `gh api .../commits`, which the GitHub
//     API returns newest-first. That is the OLDEST commit *of the first page*, and of the file at its
//     current path: exact whenever the file has a single commit there (the common case), an
//     underestimate of the file's age otherwise (a folder moved to shipped/ restarts the count).
//   - A settled outbox item's `raisedAt` is taken as its settle time (`- Approved at:`), because
//     the open file is deleted once settled. Decay for a settled item is therefore zero, which
//     under-counts a slow answer that was eventually given.
//
// Spec §8: a malformed spec, plan or outbox file is ignored (never crashes the projector), and a
// source that cannot be read reads as empty — a whole repository included, so one repository the
// App cannot read never stops the poll. Fleets are not read here: the roster (login → fleet) comes
// from Supabase with the config, and that read is hard (F7, sources/supabase.mjs). Every timestamp
// passes through `toIso` (F4); a record whose required time is unreadable is skipped. Beyond the list
// reads, each zone's sub-PR timeline gives the `omni:needs-fix` history (F1) and each closed bug's
// closing PRs say whether a merged fix closed it (F5c); both soft. An open outbox item missing an
// `id` or carrying a rank outside {medium, high, human-action} is skipped rather than pushed.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseSpec, parseOutboxItem, parseSettled, parsePlanSlices, deliveryOf, prdOfFolder } from './parsers.mjs';

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

/**
 * @param o {{ config: { tracked: string[], roster: object }, exec?: Function, now?: Date, prds?: number[] }}
 *   `prds` keeps only those PRD numbers (in every home) and the PRDs their specs name as blockers.
 */
export async function buildSnapshot({ config, exec = ghExec, now = new Date(), prds }) {
  const teams = { ...(config.roster ?? {}) };
  const wanted = prds ? new Set(prds) : null;
  const tracked = config.tracked ?? [];
  const planets = [];
  const homes = [];
  for (const home of tracked) {
    const issues = json(await soft(exec(['issue', 'list', '-R', home, '--label', 'omni:prd', '--state', 'all', '--limit', '500', '--json', 'number,title,assignees,author,createdAt,closedAt'])));
    if (issues.length) homes.push({ home, issues });
  }
  const regionsOf = partOfRegions(exec, tracked);
  for (const { home, issues } of homes) {
    const repo = await readRepository(exec, home);
    const specs = new Map(); // prd → { blockedBy }, read once
    const specOf = async (prd) => {
      if (!specs.has(prd)) {
        const folder = repo.folders.get(prd);
        specs.set(prd, folder ? parseSpec(await soft(exec(['api', `repos/${home}/contents/${folder.dir}/spec.md`, ...RAW]))) : { blockedBy: [] });
      }
      return specs.get(prd);
    };

    // A single-planet read (game:banner <prd>) must not pay for the whole workspace: keep only those
    // PRDs plus what their specs name as a blocker (one level is enough — the banner only needs to
    // know a region is locked, not to walk the whole blocker chain).
    let chosen = issues;
    if (wanted) {
      const keep = new Set();
      for (const issue of issues.filter((i) => wanted.has(i.number))) {
        keep.add(issue.number);
        for (const blocker of (await specOf(issue.number)).blockedBy) keep.add(blocker);
      }
      chosen = issues.filter((i) => keep.has(i.number));
    }

    for (const issue of chosen) planets.push(await readPlanet(exec, { home, repo, issue, teams, specOf, tracked, regionsOf }));
  }
  return { at: now.toISOString(), teams, planets };
}

// Multi-repository PRDs (PRD 728): in each tracked repository, the feature PRs into its default branch
// whose body starts `Part of <owner>/<home>#<n>`. Each is one more region of that PRD. A repository is
// read once, and only when a planet asks (a workspace with no PRD reads nothing more); one that cannot
// be read has none. A `Part of` naming a home that is not tracked is never asked for: it is ignored.
// Returns `(home, prd) → [{ slug, fp }]`: every other tracked repository's feature PR for that PRD,
// the `omni:feature` one first, else the lowest number.
const PART_OF = /^\s*Part of ([\w.-]+\/[\w.-]+)#(\d+)(?!\d)/i;
function partOfRegions(exec, tracked) {
  const indexes = new Map(); // slug → Promise<Map<'<home>#<n>', pr[]>>
  const indexOf = (slug) => {
    if (!indexes.has(slug)) {
      indexes.set(slug, (async () => {
        const defaultBranch = lines(await soft(exec(['api', `repos/${slug}`, '--jq', '.default_branch'])))[0] ?? 'main';
        const byPrd = new Map();
        const prs = json(await soft(exec(['pr', 'list', '-R', slug, '--search', '"Part of" in:body', '--base', defaultBranch, '--state', 'all', '--limit', '500', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt,labels,body'])));
        for (const pr of prs) {
          const m = PART_OF.exec(pr.body ?? '');
          if (!m || !toIso(pr.createdAt)) continue; // F4: no creation time, no feature PR
          const key = `${m[1].toLowerCase()}#${Number(m[2])}`;
          byPrd.set(key, [...(byPrd.get(key) ?? []), pr]);
        }
        return byPrd;
      })());
    }
    return indexes.get(slug);
  };
  return async (home, prd) => {
    const regions = [];
    for (const slug of tracked.filter((t) => t !== home)) {
      const prs = (await indexOf(slug)).get(`${home.toLowerCase()}#${prd}`) ?? [];
      const labelled = prs.filter((pr) => (pr.labels ?? []).some((l) => l.name === 'omni:feature'));
      const fp = (labelled.length ? labelled : prs).sort((a, b) => a.number - b.number)[0];
      if (fp) regions.push({ slug, fp });
    }
    return regions;
  };
}

// One tracked repository's default branch, delivery folder and PRD folders on its default branch, all
// soft: no config reads as the kit's default layout, and a missing folder as no PRD folder.
async function readRepository(exec, home) {
  const defaultBranch = lines(await soft(exec(['api', `repos/${home}`, '--jq', '.default_branch'])))[0] ?? 'main';
  const delivery = deliveryOf(await soft(exec(['api', `repos/${home}/contents/.omni-loop/config.yml`, ...RAW])));
  const folders = new Map(); // prd → { stage, name, dir }: the inbox before shipped, the first name first
  for (const stage of ['inbox', 'shipped']) {
    const names = lines(await soft(exec(['api', `repos/${home}/contents/${delivery}/${stage}`, '--jq', '.[] | select(.type=="dir") | .name']))).sort();
    for (const name of names) {
      const prd = prdOfFolder(name);
      if (prd && !folders.has(prd)) folders.set(prd, { stage, name, dir: `${delivery}/${stage}/${name}` });
    }
  }
  return { defaultBranch, delivery, folders };
}

async function readPlanet(exec, { home, repo, issue, teams, specOf, tracked, regionsOf }) {
  const prd = issue.number;
  const createdAt = toIso(issue.createdAt);
  // The owner: the first assignee, else the issue's author (PRD 728). Their fleet owns the planet.
  const captain = issue.assignees?.[0]?.login ?? issue.author?.login ?? null;
  const planet = {
    prd, home, title: issue.title, captain, ownerTeam: captain ? teams[captain.toLowerCase()] ?? null : null,
    issue: { createdAt, closedAt: toIso(issue.closedAt) },
    regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
  };
  const folder = repo.folders.get(prd);
  // No folder: charted, never surveyed. No birth time (F4): the projector skips the charting.
  if (!createdAt || !folder) return planet;

  // Spec §8: a failed commits read leaves surveyedAt to the PRD issue's createdAt.
  const surveyedAt = firstIso(await soft(exec(['api', `repos/${home}/commits?path=${folder.dir}/spec.md&per_page=100`, '--jq', '.[-1].commit.committer.date']))) ?? createdAt;
  planet.regions.push({ repo: home, blockedBy: (await specOf(prd)).blockedBy, surveyedAt, featurePr: null });

  const closes = new RegExp(`\\bCloses #${prd}(?!\\d)`, 'i');
  const prs = json(await exec(['pr', 'list', '-R', home, '--search', `"Closes #${prd}" in:body`, '--base', repo.defaultBranch, '--state', 'all', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt,labels,body']))
    .filter((pr) => toIso(pr.createdAt) && closes.test(pr.body ?? '')); // F4: no creation time, no feature PR
  const labelled = prs.filter((pr) => (pr.labels ?? []).some((l) => l.name === 'omni:feature'));
  const fp = (labelled.length ? labelled : prs).sort((a, b) => a.number - b.number)[0];

  // Multi-repository (PRD 728): each `Part of <home>#<n>` feature PR in another tracked repository is
  // one more region, surveyed when that PR opened. The PRD's blockers stay on its home region.
  const parts = await regionsOf(home, prd);
  const features = new Map(fp ? [[home, fp]] : []); // region → its feature PR
  for (const { slug, fp: part } of parts) {
    features.set(slug, part);
    planet.regions.push({ repo: slug, blockedBy: [], surveyedAt: toIso(part.createdAt), featurePr: null });
  }
  const planned = new Set(); // the regions the plan gives slices (F3)
  if (features.size) {
    for (const r of planet.regions) if (features.has(r.repo)) r.featurePr = await readFeaturePr(exec, r.repo, features.get(r.repo));
    // The plan and the outbox live in the home: at its feature PR's head while that PR is open (the
    // folder may have moved to shipped/ there), else on the default branch (its head may be gone).
    const ref = fp && !fp.mergedAt ? fp.headRefName : repo.defaultBranch;
    const planText = await readPlan(exec, { home, repo, folder, ref });
    const slices = parsePlanSlices(planText);
    const repoCell = sliceRepos(planText);
    const regionOf = regionResolver({ home, tracked, parts });
    const bySlug = new Map([...features.keys()].map((slug) => [slug, []]));
    for (const slice of slices) {
      const slug = regionOf(repoCell.get(slice.id));
      if (slug) bySlug.set(slug, [...(bySlug.get(slug) ?? []), slice]); // a slice of no tracked repository is not read
    }
    const subs = [];
    for (const [slug, own] of bySlug) {
      if (own.length) planned.add(slug);
      subs.push(...await readZones(exec, { planet, slug, fp: features.get(slug) ?? null, slices: own }));
    }
    await readOutbox(exec, { planet, home, repo, folder, ref, subs });
  }
  if (fp) {
    const bugs = json(await soft(exec(['issue', 'list', '-R', home, '--label', 'bug', '--state', 'all', '--search', `#${prd}`, '--json', 'number,createdAt,closedAt,closedBy'])));
    for (const b of bugs) {
      const bugCreatedAt = toIso(b.createdAt);
      if (!bugCreatedAt) continue;
      const bugClosedAt = toIso(b.closedAt);
      const fixedBy = bugClosedAt ? await bugFixedBy(exec, home, b.number) : null;
      planet.bugs.push({ repo: home, number: b.number, createdAt: bugCreatedAt, closedAt: bugClosedAt, closedBy: b.closedBy?.login ?? null, fixedBy });
    }
  }
  planet.featurePr = aggregateFeaturePr(planet.regions, planned);
  return planet;
}

// A plan repository's slice table names the repository each slice lands in, in a `repo` column
// (PRD 549, as kit/lib/inbox/territory.mjs reads it): slice id → that cell, null when empty. An
// ordinary plan has no such column, and every slice is its home's.
function sliceRepos(text) {
  const out = new Map();
  let cols = null;
  for (const line of (text ?? '').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const header = cells.map((c) => c.toLowerCase());
    if (header.includes('id') && header.includes('blocked by') && header.includes('wave')) {
      cols = { id: header.indexOf('id'), repo: header.indexOf('repo') };
      continue;
    }
    if (!cols || cols.repo === -1 || !/^s\d+$/.test(cells[cols.id] ?? '')) continue;
    out.set(cells[cols.id], (cells[cols.repo] ?? '').replace(/`/g, '').trim() || null);
  }
  return out;
}

// A slice's `repo` cell → the tracked repository it lands in. None named: the home. A full name: that
// one, if tracked. A short name (a `plan.targets` entry's name after the `/`): the tracked repository
// of that name that holds a `Part of` region for this PRD, else the one of the home's owner, else any.
// null when no tracked repository matches.
function regionResolver({ home, tracked, parts }) {
  const owner = home.split('/')[0];
  return (cell) => {
    if (!cell) return home;
    const name = cell.toLowerCase();
    if (name.includes('/')) return tracked.includes(name) ? name : null;
    const matches = tracked.filter((t) => t.split('/')[1] === name);
    return matches.find((t) => parts.some((p) => p.slug === t)) ?? matches.find((t) => t.split('/')[0] === owner) ?? matches[0] ?? null;
  };
}

// A region's feature PR, in the shape every consumer of `region.featurePr` reads.
async function readFeaturePr(exec, slug, fp) {
  const createdAt = toIso(fp.createdAt);
  const readyAt = fp.isDraft ? null : (firstIso(await soft(exec(['api', `repos/${slug}/issues/${fp.number}/timeline`, '--paginate', '--jq', '[.[] | select(.event=="ready_for_review")][0].created_at']))) ?? createdAt);
  return { repo: slug, number: fp.number, createdAt, readyAt, mergedAt: toIso(fp.mergedAt), lastActivityAt: toIso(fp.updatedAt) ?? createdAt };
}

async function readPlan(exec, { home, repo, folder, ref }) {
  const inbox = `${repo.delivery}/inbox/${folder.name}`;
  const shipped = `${repo.delivery}/shipped/${folder.name}`;
  for (const dir of folder.stage === 'shipped' ? [shipped, inbox] : [inbox, shipped]) {
    const text = await soft(exec(['api', `repos/${home}/contents/${dir}/plan.md?ref=${ref}`, ...RAW]));
    if (text.trim()) return text;
  }
  return '';
}

// One region's zones: its slices, each matched to a sub-PR (`omni:sub`, into the region's feature
// branch) by the head ref's `--<slice>` suffix. A region with no feature PR yet has sealed zones only.
// Returns the region's sub-PRs.
async function readZones(exec, { planet, slug, fp, slices }) {
  if (!slices.length) return [];
  // --json includes `body` (beyond the reads list's bare field set) because the revert rule
  // below — "a sub-PR titled Revert whose body names #<n>" — cannot be read without it.
  const subs = !fp ? [] : json(await exec(['pr', 'list', '-R', slug, '--base', fp.headRefName, '--state', 'all', '--label', 'omni:sub', '--limit', '200', '--json', 'number,title,headRefName,author,createdAt,labels,mergedAt,body,state']))
    .map((x) => ({ ...x, createdAt: toIso(x.createdAt), mergedAt: toIso(x.mergedAt) }))
    .filter((x) => x.createdAt); // F4: a sub-PR without a creation time is unreadable, not a claim
  const reverts = new Map(subs.filter((s) => /^revert/i.test(s.title) && s.mergedAt).flatMap((s) => [...(s.body ?? '').matchAll(/#(\d+)/g)].map((m) => [Number(m[1]), s.mergedAt])));
  for (const slice of slices) {
    const sub = zoneSub(subs, slice.id, reverts);
    const labels = sub ? sub.labels.map((l) => l.name) : [];
    planet.zones.push({
      id: slice.id, repo: slug, wave: slice.wave, blockedBy: slice.blockedBy,
      pr: sub ? {
        number: sub.number, author: sub.author?.login ?? null, createdAt: sub.createdAt, labels, mergedAt: sub.mergedAt, revertedAt: reverts.get(sub.number) ?? null,
        needsFix: await needsFixHistory(exec, slug, sub, labels),
      } : null,
    });
  }
  return subs;
}

// The outbox, in the home: `<delivery>/outbox/<folder>/` while the PRD is built, `<folder>/outbox/`
// once shipped. `subs` are every region's sub-PRs: a drift's rework is looked for among them.
async function readOutbox(exec, { planet, home, repo, folder, ref, subs }) {
  const shipped = `${repo.delivery}/shipped/${folder.name}`;
  const outbox = `${repo.delivery}/outbox/${folder.name}`;
  let dir = null;
  let names = [];
  for (const candidate of folder.stage === 'shipped' ? [`${shipped}/outbox`, outbox] : [outbox, `${shipped}/outbox`]) {
    names = lines(await soft(exec(['api', `repos/${home}/contents/${candidate}?ref=${ref}`, '--jq', '.[].name'])));
    if (names.length) { dir = candidate; break; }
  }
  if (!dir) return;
  const settled = names.includes('settled.md') ? parseSettled(await soft(exec(['api', `repos/${home}/contents/${dir}/settled.md?ref=${ref}`, ...RAW]))) : new Map();
  for (const name of names.filter((n) => n.endsWith('.md') && n !== 'settled.md' && n !== 'README.md')) {
    const item = parseOutboxItem(await soft(exec(['api', `repos/${home}/contents/${dir}/${name}?ref=${ref}`, ...RAW])));
    if (!item.id || !OUTBOX_RANKS.has(item.rank) || settled.has(item.id)) continue; // spec §8: a malformed outbox file is ignored
    // F4: first commit, else the `raised` date at 07:00Z, else the item is skipped.
    const raisedAt = firstIso(await soft(exec(['api', `repos/${home}/commits?path=${dir}/${name}&sha=${ref}&per_page=100`, '--jq', '.[-1].commit.committer.date'])))
      ?? (/^\d{4}-\d{2}-\d{2}$/.test(item.raised ?? '') ? toIso(`${item.raised}T07:00:00Z`) : null);
    if (!raisedAt) continue;
    planet.outbox.push({ id: item.id, repo: home, rank: item.rank, raisedAt, settled: null });
  }
  for (const [id, s] of settled) {
    const at = toIso(s.at);
    if (!at) continue; // F4: a settle without a readable `Approved at` is skipped
    // F6: the rework sub-PR's author is who closes the fault line a drift opened.
    const rework = s.verdict === 'drifted' ? subs.find((x) => x.mergedAt && new RegExp(`\\b${id}\\b`).test(x.body ?? '')) : null;
    planet.outbox.push({ id, repo: home, rank: s.rank ?? 'medium', raisedAt: at, settled: { verdict: s.verdict, at, by: s.by, reworkMergedAt: rework?.mergedAt ?? null, reworkBy: rework?.author?.login ?? null } });
  }
}

// F3: the planet's feature PR, aggregated over its regions (same shape as a region's, so every
// consumer of `planet.featurePr` reads it unchanged). null when no region has one; `createdAt` the
// earliest; `readyAt` / `mergedAt` the latest, and only once every region's feature PR — and every
// repository the plan gives slices, which has none until its `Part of` PR opens (PRD 728) — is ready /
// merged; `repo`/`number` are the first region's. A planet is therefore terraformed at its last
// region's merge, not its first.
function aggregateFeaturePr(regions, planned) {
  const fps = regions.map((r) => r.featurePr).filter(Boolean);
  if (!fps.length) return null;
  const waited = new Set([...regions.filter((r) => r.featurePr).map((r) => r.repo), ...planned]);
  const required = [...waited].map((repo) => regions.find((r) => r.repo === repo)?.featurePr ?? null);
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
async function bugFixedBy(exec, slug, number) {
  const org = slug.split('/')[0];
  let refs = null;
  try {
    refs = JSON.parse(await exec(['issue', 'view', String(number), '-R', slug, '--json', 'closedByPullRequestsReferences'])).closedByPullRequestsReferences;
  } catch {
    refs = null;
  }
  if (Array.isArray(refs)) {
    const merged = [];
    for (const ref of refs) {
      const prSlug = ref.repository?.name ? `${ref.repository.owner?.login ?? org}/${ref.repository.name}` : slug;
      let pr = {};
      try { pr = JSON.parse(await exec(['pr', 'view', String(ref.number), '-R', prSlug, '--json', 'mergedAt,author'])); } catch { pr = {}; }
      const mergedAt = toIso(pr?.mergedAt);
      if (mergedAt && pr.author?.login) merged.push({ mergedAt, by: pr.author.login });
    }
    return merged.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))[0]?.by ?? null;
  }
  const closed = lines(await soft(exec(['api', `repos/${slug}/issues/${number}/timeline`, '--paginate', '--jq', '.[] | select(.event=="closed") | "\\(.commit_id) \\(.actor.login)"']))).at(-1);
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
