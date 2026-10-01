// The one impure module: builds a world snapshot from GitHub through the gh CLI (spec §7.3).
// Every call goes through `exec` so tests run on fixtures. Reads only — no `gh pr edit`, no
// `gh issue comment`, no POST of any kind.
//
// What it reads (PRD 728): the workspace's tracked repositories (`config.tracked`, owner/name, from
// public.repositories; an untracked or absent repository is not read). Each one's `omni:prd` issues
// are its PRDs: a PRD's **home** is the repository of its issue, and its planet is keyed
// `<home>#<n>`, so two repositories' PRD 88 are two planets. A PRD's work is read from its folder in
// the kit layout, `<delivery>/{inbox,shipped}/<nnnn>-<topic>/` (the delivery path from the
// repository's `.omni-loop/config.yml`, as game/dossiers/folders.ts mirrors it): `spec.md` for
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
import { z } from 'zod';
import { parseSpec, parseOutboxItem, parseSettled, parsePlanSlices, parsePlanRepos, deliveryOf, prdOfFolder, type PlanSlice, type SettledEntry } from './parsers.ts';
import type { GameConfig } from '../config.ts';
import type { Bug, FeaturePr, NeedsFix, OutboxEntry, Planet, Region, Snapshot } from '../types.ts';

/** How the game calls gh: its arguments in, its stdout out. */
export type Exec = (args: string[]) => Promise<string>;

const run = promisify(execFile);
export const ghExec: Exec = async (args) => (await run('gh', args, { maxBuffer: 64 * 1024 * 1024 })).stdout;

// What gh prints for the lists and views below. A field the code reads only when it is there may be
// missing; one it counts on is required, so a gh that answers another shape fails naming the field.
const Login = z.looseObject({ login: z.string().nullish() }).nullish();
const Labels = z.array(z.looseObject({ name: z.string() })).nullish();
const IssueRows = z.array(z.looseObject({
  number: z.number().int(),
  title: z.string(),
  assignees: z.array(Login).nullish(),
  author: Login,
  createdAt: z.string().nullish(),
  closedAt: z.string().nullish(),
}));
const PrRow = z.looseObject({
  number: z.number().int(),
  headRefName: z.string(),
  createdAt: z.string().nullish(),
  isDraft: z.boolean().nullish(),
  mergedAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  labels: Labels,
  body: z.string().nullish(),
});
const PrRows = z.array(PrRow);
const SubRowSchema = z.looseObject({
  number: z.number().int(),
  title: z.string(),
  headRefName: z.string(),
  author: Login,
  createdAt: z.string().nullish(),
  labels: z.array(z.looseObject({ name: z.string() })),
  mergedAt: z.string().nullish(),
  body: z.string().nullish(),
  state: z.string().nullish(),
});
const SubRows = z.array(SubRowSchema);
const BugRows = z.array(z.looseObject({
  number: z.number().int(),
  createdAt: z.string().nullish(),
  closedAt: z.string().nullish(),
  closedBy: Login,
}));
const ClosingRefs = z.looseObject({ closedByPullRequestsReferences: z.unknown() }).nullable();
const ClosingRef = z.looseObject({
  number: z.number().int(),
  repository: z.looseObject({ name: z.string().nullish(), owner: Login }).nullish(),
});
const ViewedPr = z.looseObject({ mergedAt: z.string().nullish(), author: Login }).nullable();

type PrRow = z.infer<typeof PrRow>;
type SubRow = z.infer<typeof SubRowSchema> & { createdAt: string; mergedAt: string | null };
type IssueRow = z.infer<typeof IssueRows>[number];
type Folder = { stage: string; name: string; dir: string };
type Repository = { defaultBranch: string; delivery: string; folders: Map<number, Folder> };
type Part = { slug: string; fp: PrRow };
type RegionsOf = (home: string, prd: number) => Promise<Part[]>;
type SpecOf = (prd: number) => Promise<{ blockedBy: number[] }>;

const RAW = ['-H', 'Accept: application/vnd.github.raw'];
const lines = (s: string): string[] => s.split('\n').map((l) => l.trim()).filter(Boolean);
const json = (s: string): unknown => (s.trim() ? JSON.parse(s) : []);
const soft = (p: Promise<string>): Promise<string> => p.catch(() => ''); // a 404 (no outbox dir yet, no plan yet) is an empty read
const OUTBOX_RANKS = new Set<string | undefined>(['medium', 'high', 'human-action']); // spec §8: a malformed outbox file is ignored

// F4: every timestamp read from GitHub or a delivery file goes through here, so one malformed value
// never reaches the projector as a crash. Empty, missing, jq's "null" and unparseable → null; anything
// else → UTC ISO without milliseconds (`2026-09-22T10:00:00Z`). A date-only value is UTC midnight.
export function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === 'null') return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
const firstIso = (out: string): string | null => toIso(lines(out)[0]);

/**
 * `prds` keeps only those PRD numbers (in every home) and the PRDs their specs name as blockers.
 */
export async function buildSnapshot(
  { config, exec = ghExec, now = new Date(), prds }: { config: Partial<Pick<GameConfig, 'tracked' | 'roster'>>; exec?: Exec; now?: Date; prds?: readonly number[] },
): Promise<Snapshot> {
  const teams = { ...(config.roster ?? {}) };
  const wanted = prds ? new Set(prds) : null;
  const tracked = config.tracked ?? [];
  const planets: Planet[] = [];
  const homes: Array<{ home: string; issues: IssueRow[] }> = [];
  for (const home of tracked) {
    const issues = IssueRows.parse(json(await soft(exec(['issue', 'list', '-R', home, '--label', 'omni:prd', '--state', 'all', '--limit', '500', '--json', 'number,title,assignees,author,createdAt,closedAt']))));
    if (issues.length) homes.push({ home, issues });
  }
  const regionsOf = partOfRegions(exec, tracked);
  for (const { home, issues } of homes) {
    const repo = await readRepository(exec, home);
    const specs = new Map<number, { blockedBy: number[] }>(); // prd → { blockedBy }, read once
    const specOf: SpecOf = async (prd) => {
      if (!specs.has(prd)) {
        const folder = repo.folders.get(prd);
        specs.set(prd, folder ? parseSpec(await soft(exec(['api', `repos/${home}/contents/${folder.dir}/spec.md`, ...RAW]))) : { blockedBy: [] });
      }
      return specs.get(prd) ?? { blockedBy: [] };
    };

    // A single-planet read (game:banner <prd>) must not pay for the whole workspace: keep only those
    // PRDs plus what their specs name as a blocker (one level is enough — the banner only needs to
    // know a region is locked, not to walk the whole blocker chain).
    let chosen = issues;
    if (wanted) {
      const keep = new Set<number>();
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
function partOfRegions(exec: Exec, tracked: readonly string[]): RegionsOf {
  const indexes = new Map<string, Promise<Map<string, PrRow[]>>>(); // slug → Promise<Map<'<home>#<n>', pr[]>>
  const indexOf = (slug: string): Promise<Map<string, PrRow[]>> => {
    const known = indexes.get(slug);
    if (known) return known;
    {
      const index = (async () => {
        const defaultBranch = lines(await soft(exec(['api', `repos/${slug}`, '--jq', '.default_branch'])))[0] ?? 'main';
        const byPrd = new Map<string, PrRow[]>();
        const prs = PrRows.parse(json(await soft(exec(['pr', 'list', '-R', slug, '--search', '"Part of" in:body', '--base', defaultBranch, '--state', 'all', '--limit', '500', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt,labels,body']))));
        for (const pr of prs) {
          const m = PART_OF.exec(pr.body ?? '');
          if (!m || !toIso(pr.createdAt)) continue; // F4: no creation time, no feature PR
          const key = `${(m[1] ?? '').toLowerCase()}#${Number(m[2])}`;
          byPrd.set(key, [...(byPrd.get(key) ?? []), pr]);
        }
        return byPrd;
      })();
      indexes.set(slug, index);
      return index;
    }
  };
  return async (home, prd) => {
    const regions: Part[] = [];
    for (const slug of tracked.filter((t) => t !== home)) {
      const fp = pickFeaturePr((await indexOf(slug)).get(`${home.toLowerCase()}#${prd}`) ?? []);
      if (fp) regions.push({ slug, fp });
    }
    return regions;
  };
}

// Among a PRD's feature PR candidates, the `omni:feature` one first, else the lowest number.
function pickFeaturePr(prs: PrRow[]): PrRow | undefined {
  const labelled = prs.filter((pr) => (pr.labels ?? []).some((l) => l.name === 'omni:feature'));
  return (labelled.length ? labelled : prs).sort((a, b) => a.number - b.number)[0];
}

// One tracked repository's default branch, delivery folder and PRD folders on its default branch, all
// soft: no config reads as the kit's default layout, and a missing folder as no PRD folder.
async function readRepository(exec: Exec, home: string): Promise<Repository> {
  const defaultBranch = lines(await soft(exec(['api', `repos/${home}`, '--jq', '.default_branch'])))[0] ?? 'main';
  const delivery = deliveryOf(await soft(exec(['api', `repos/${home}/contents/.omni-loop/config.yml`, ...RAW])));
  const folders = new Map<number, Folder>(); // prd → { stage, name, dir }: the inbox before shipped, the first name first
  for (const stage of ['inbox', 'shipped']) {
    const names = lines(await soft(exec(['api', `repos/${home}/contents/${delivery}/${stage}`, '--jq', '.[] | select(.type=="dir") | .name']))).sort();
    for (const name of names) {
      const prd = prdOfFolder(name);
      if (prd && !folders.has(prd)) folders.set(prd, { stage, name, dir: `${delivery}/${stage}/${name}` });
    }
  }
  return { defaultBranch, delivery, folders };
}

async function readPlanet(
  exec: Exec,
  { home, repo, issue, teams, specOf, tracked, regionsOf }: { home: string; repo: Repository; issue: IssueRow; teams: Record<string, string>; specOf: SpecOf; tracked: readonly string[]; regionsOf: RegionsOf },
): Promise<Planet> {
  const planet = chartPlanet(home, issue, teams);
  const { prd, issue: { createdAt } } = planet;
  const folder = repo.folders.get(prd);
  // No folder: charted, never surveyed. No birth time (F4): the projector skips the charting.
  if (!createdAt || !folder) return planet;

  // Spec §8: a failed commits read leaves surveyedAt to the PRD issue's createdAt.
  const surveyedAt = firstIso(await soft(exec(['api', `repos/${home}/commits?path=${folder.dir}/spec.md&per_page=100`, '--jq', '.[-1].commit.committer.date']))) ?? createdAt;
  planet.regions.push({ repo: home, blockedBy: (await specOf(prd)).blockedBy, surveyedAt, featurePr: null });

  const fp = await homeFeaturePr(exec, { home, repo, prd });
  // Multi-repository (PRD 728): each `Part of <home>#<n>` feature PR in another tracked repository is
  // one more region, surveyed when that PR opened. The PRD's blockers stay on its home region.
  const parts = await regionsOf(home, prd);
  const features = new Map<string, PrRow>(fp ? [[home, fp]] : []); // region → its feature PR
  for (const { slug, fp: part } of parts) {
    features.set(slug, part);
    planet.regions.push({ repo: slug, blockedBy: [], surveyedAt: toIso(part.createdAt), featurePr: null });
  }
  // The regions the plan gives slices (F3).
  const planned = features.size ? await readWork(exec, { planet, home, repo, folder, tracked, fp, parts, features }) : new Set<string>();
  if (fp) planet.bugs.push(...await readBugs(exec, home, prd));
  planet.featurePr = aggregateFeaturePr(planet.regions, planned);
  return planet;
}

// A PRD issue as a planet, charted and not yet surveyed. The owner: the first assignee, else the
// issue's author (PRD 728). Their fleet owns the planet.
function chartPlanet(home: string, issue: IssueRow, teams: Record<string, string>): Planet {
  const captain = issue.assignees?.[0]?.login ?? issue.author?.login ?? null;
  return {
    prd: issue.number, home, title: issue.title, captain, ownerTeam: captain ? teams[captain.toLowerCase()] ?? null : null,
    issue: { createdAt: toIso(issue.createdAt), closedAt: toIso(issue.closedAt) },
    regions: [], featurePr: null, zones: [], outbox: [], bugs: [],
  };
}

// The home's feature PR: a PR into its default branch whose body says `Closes #<n>`.
async function homeFeaturePr(exec: Exec, { home, repo, prd }: { home: string; repo: Repository; prd: number }): Promise<PrRow | undefined> {
  const closes = new RegExp(`\\bCloses #${prd}(?!\\d)`, 'i');
  const prs = PrRows.parse(json(await exec(['pr', 'list', '-R', home, '--search', `"Closes #${prd}" in:body`, '--base', repo.defaultBranch, '--state', 'all', '--json', 'number,headRefName,createdAt,isDraft,mergedAt,updatedAt,labels,body'])))
    .filter((pr) => toIso(pr.createdAt) && closes.test(pr.body ?? '')); // F4: no creation time, no feature PR
  return pickFeaturePr(prs);
}

// A planet with a feature PR in some region: each region's feature PR, its zones and its outbox.
// Returns the regions the plan gives slices.
async function readWork(
  exec: Exec,
  { planet, home, repo, folder, tracked, fp, parts, features }: { planet: Planet; home: string; repo: Repository; folder: Folder; tracked: readonly string[]; fp: PrRow | undefined; parts: Part[]; features: Map<string, PrRow> },
): Promise<Set<string>> {
  for (const r of planet.regions) {
    const feature = features.get(r.repo);
    if (feature) r.featurePr = await readFeaturePr(exec, r.repo, feature);
  }
  // The plan and the outbox live in the home: at its feature PR's head while that PR is open (the
  // folder may have moved to shipped/ there), else on the default branch (its head may be gone).
  const ref = fp && !fp.mergedAt ? fp.headRefName : repo.defaultBranch;
  const planText = await readPlan(exec, { home, repo, folder, ref });
  const bySlug = slicesByRegion(planText, { home, tracked, parts, regions: features.keys() });
  const planned = new Set<string>();
  const subs: SubRow[] = [];
  for (const [slug, own] of bySlug) {
    if (own.length) planned.add(slug);
    subs.push(...await readZones(exec, { planet, slug, fp: features.get(slug) ?? null, slices: own }));
  }
  await readOutbox(exec, { planet, home, repo, folder, ref, subs });
  return planned;
}

// The plan's slices, by the region each lands in: every region with a feature PR first (with none
// yet), then any other the slices name. A slice of no tracked repository is not read.
function slicesByRegion(planText: string, { home, tracked, parts, regions }: { home: string; tracked: readonly string[]; parts: Part[]; regions: Iterable<string> }): Map<string, PlanSlice[]> {
  const repoCell = parsePlanRepos(planText);
  const regionOf = regionResolver({ home, tracked, parts });
  const bySlug = new Map<string, PlanSlice[]>([...regions].map((slug) => [slug, []]));
  for (const slice of parsePlanSlices(planText)) {
    const slug = regionOf(repoCell.get(slice.id));
    if (slug) bySlug.set(slug, [...(bySlug.get(slug) ?? []), slice]);
  }
  return bySlug;
}

// The home's bugs that name the PRD, each with who fixed it once closed (F5c). A bug without a
// readable creation time is skipped (F4).
async function readBugs(exec: Exec, home: string, prd: number): Promise<Bug[]> {
  const bugs: Bug[] = [];
  for (const b of BugRows.parse(json(await soft(exec(['issue', 'list', '-R', home, '--label', 'bug', '--state', 'all', '--search', `#${prd}`, '--json', 'number,createdAt,closedAt,closedBy']))))) {
    const createdAt = toIso(b.createdAt);
    if (!createdAt) continue;
    const closedAt = toIso(b.closedAt);
    const fixedBy = closedAt ? await bugFixedBy(exec, home, b.number) : null;
    bugs.push({ repo: home, number: b.number, createdAt, closedAt, closedBy: b.closedBy?.login ?? null, fixedBy });
  }
  return bugs;
}

// A slice's `repo` cell → the tracked repository it lands in. None named: the home. A full name: that
// one, if tracked. A short name (a `plan.targets` entry's name after the `/`): the tracked repository
// of that name that holds a `Part of` region for this PRD, else the one of the home's owner, else any.
// null when no tracked repository matches.
function regionResolver({ home, tracked, parts }: { home: string; tracked: readonly string[]; parts: Part[] }): (cell: string | null | undefined) => string | null {
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
async function readFeaturePr(exec: Exec, slug: string, fp: PrRow): Promise<FeaturePr> {
  const createdAt = toIso(fp.createdAt);
  const readyAt = fp.isDraft ? null : (firstIso(await soft(exec(['api', `repos/${slug}/issues/${fp.number}/timeline`, '--paginate', '--jq', '[.[] | select(.event=="ready_for_review")][0].created_at']))) ?? createdAt);
  return { repo: slug, number: fp.number, createdAt, readyAt, mergedAt: toIso(fp.mergedAt), lastActivityAt: toIso(fp.updatedAt) ?? createdAt };
}

async function readPlan(exec: Exec, { home, repo, folder, ref }: { home: string; repo: Repository; folder: Folder; ref: string }): Promise<string> {
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
async function readZones(exec: Exec, { planet, slug, fp, slices }: { planet: Planet; slug: string; fp: PrRow | null; slices: PlanSlice[] }): Promise<SubRow[]> {
  if (!slices.length) return [];
  // --json includes `body` (beyond the reads list's bare field set) because the revert rule
  // below — "a sub-PR titled Revert whose body names #<n>" — cannot be read without it.
  const subs: SubRow[] = !fp ? [] : SubRows.parse(json(await exec(['pr', 'list', '-R', slug, '--base', fp.headRefName, '--state', 'all', '--label', 'omni:sub', '--limit', '200', '--json', 'number,title,headRefName,author,createdAt,labels,mergedAt,body,state'])))
    .map((x) => ({ ...x, createdAt: toIso(x.createdAt), mergedAt: toIso(x.mergedAt) }))
    .filter((x): x is SubRow => Boolean(x.createdAt)); // F4: a sub-PR without a creation time is unreadable, not a claim
  const reverts = new Map(subs.flatMap((s) => {
    const { mergedAt } = s;
    return /^revert/i.test(s.title) && mergedAt ? [...(s.body ?? '').matchAll(/#(\d+)/g)].map((m) => [Number(m[1]), mergedAt] as const) : [];
  }));
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
async function readOutbox(exec: Exec, { planet, home, repo, folder, ref, subs }: { planet: Planet; home: string; repo: Repository; folder: Folder; ref: string; subs: SubRow[] }): Promise<void> {
  const { dir, names } = await findOutbox(exec, { home, repo, folder, ref });
  if (!dir) return;
  const at = { home, dir, ref };
  const settled = names.includes('settled.md') ? parseSettled(await soft(exec(['api', `repos/${home}/contents/${dir}/settled.md?ref=${ref}`, ...RAW]))) : new Map<string, SettledEntry>();
  for (const name of names.filter((n) => n.endsWith('.md') && n !== 'settled.md' && n !== 'README.md')) {
    const item = await readOpenItem(exec, at, name, settled);
    if (item) planet.outbox.push(item);
  }
  for (const [id, s] of settled) {
    const item = settledItem(id, s, { home, subs });
    if (item) planet.outbox.push(item);
  }
}

// The outbox folder that lists files, the shipped one first once the PRD has shipped: { dir, names },
// dir null when neither does.
async function findOutbox(exec: Exec, { home, repo, folder, ref }: { home: string; repo: Repository; folder: Folder; ref: string }): Promise<{ dir: string | null; names: string[] }> {
  const shipped = `${repo.delivery}/shipped/${folder.name}/outbox`;
  const outbox = `${repo.delivery}/outbox/${folder.name}`;
  for (const dir of folder.stage === 'shipped' ? [shipped, outbox] : [outbox, shipped]) {
    const names = lines(await soft(exec(['api', `repos/${home}/contents/${dir}?ref=${ref}`, '--jq', '.[].name'])));
    if (names.length) return { dir, names };
  }
  return { dir: null, names: [] };
}

// One open outbox item, or null: a malformed file (spec §8), an item already settled, or one with no
// readable raise time. F4: its first commit, else the `raised` date at 07:00Z, else it is skipped.
async function readOpenItem(exec: Exec, { home, dir, ref }: { home: string; dir: string; ref: string }, name: string, settled: Map<string, SettledEntry>): Promise<OutboxEntry | null> {
  const item = parseOutboxItem(await soft(exec(['api', `repos/${home}/contents/${dir}/${name}?ref=${ref}`, ...RAW])));
  if (!item.id || !OUTBOX_RANKS.has(item.rank) || settled.has(item.id)) return null;
  const raisedAt = firstIso(await soft(exec(['api', `repos/${home}/commits?path=${dir}/${name}&sha=${ref}&per_page=100`, '--jq', '.[-1].commit.committer.date'])))
    ?? raisedDay(item.raised);
  return raisedAt ? { id: item.id, repo: home, rank: item.rank ?? '', raisedAt, settled: null } : null;
}

const raisedDay = (raised: string | undefined): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(raised ?? '') ? toIso(`${raised}T07:00:00Z`) : null);

// One settled outbox item, or null when its `Approved at` is unreadable (F4).
function settledItem(id: string, s: SettledEntry, { home, subs }: { home: string; subs: SubRow[] }): OutboxEntry | null {
  const at = toIso(s.at);
  if (!at) return null;
  const rework = reworkOf(id, s.verdict, subs);
  return { id, repo: home, rank: s.rank ?? 'medium', raisedAt: at, settled: { verdict: s.verdict, at, by: s.by, reworkMergedAt: rework?.mergedAt ?? null, reworkBy: rework?.author?.login ?? null } };
}

// F6: the rework sub-PR's author is who closes the fault line a drift opened.
function reworkOf(id: string, verdict: string | null, subs: SubRow[]): SubRow | null | undefined {
  return verdict === 'drifted' ? subs.find((x) => x.mergedAt && new RegExp(`\\b${id}\\b`).test(x.body ?? '')) : null;
}

// F3: the planet's feature PR, aggregated over its regions (same shape as a region's, so every
// consumer of `planet.featurePr` reads it unchanged). null when no region has one; `createdAt` the
// earliest; `readyAt` / `mergedAt` the latest, and only once every region's feature PR — and every
// repository the plan gives slices, which has none until its `Part of` PR opens (PRD 728) — is ready /
// merged; `repo`/`number` are the first region's. A planet is therefore terraformed at its last
// region's merge, not its first.
function aggregateFeaturePr(regions: Region[], planned: Set<string>): FeaturePr | null {
  const fps = regions.map((r) => r.featurePr).filter((fp): fp is FeaturePr => Boolean(fp));
  const [first] = fps;
  if (!first) return null;
  const waited = new Set([...regions.filter((r) => r.featurePr).map((r) => r.repo), ...planned]);
  const required = [...waited].map((repo) => regions.find((r) => r.repo === repo)?.featurePr ?? null);
  const latest = (field: 'readyAt' | 'mergedAt'): string | null => {
    const times = required.map((fp) => fp?.[field]);
    return times.every((t): t is string => Boolean(t)) ? times.sort().at(-1) ?? null : null;
  };
  return {
    repo: first.repo, number: first.number,
    createdAt: fps.map((fp) => fp.createdAt).sort()[0] ?? null,
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
async function bugFixedBy(exec: Exec, slug: string, number: number): Promise<string | null> {
  const refs = await closingRefs(exec, slug, number);
  if (!Array.isArray(refs)) return closedByCommit(exec, slug, number);
  const merged: Array<{ mergedAt: string; by: string }> = [];
  for (const ref of refs) {
    const fix = await mergedFix(exec, refSlug(ref, slug), ref.number);
    if (fix) merged.push(fix);
  }
  return merged.sort((a, b) => a.mergedAt.localeCompare(b.mergedAt))[0]?.by ?? null;
}

// A gh read parsed as JSON, then by `schema`; a read or a parse that fails reads as null.
async function readJson<T>(read: () => Promise<string>, schema: z.ZodType<T>): Promise<T | null> {
  let value: unknown;
  try {
    value = JSON.parse(await read());
  } catch {
    return null;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// The PRs that closed a bug, or null where the gh in use cannot say (or the read fails).
async function closingRefs(exec: Exec, slug: string, number: number): Promise<Array<z.infer<typeof ClosingRef>> | null> {
  const refs = (await readJson(() => exec(['issue', 'view', String(number), '-R', slug, '--json', 'closedByPullRequestsReferences']), ClosingRefs))?.closedByPullRequestsReferences ?? null;
  if (!Array.isArray(refs)) return null;
  const parsed = z.array(ClosingRef).safeParse(refs);
  return parsed.success ? parsed.data : null;
}

// A closing PR reference's repository: its own when it names one (the bug's owner by default), else the bug's.
const refSlug = (ref: z.infer<typeof ClosingRef>, slug: string): string => (ref.repository?.name ? `${ref.repository.owner?.login ?? slug.split('/')[0]}/${ref.repository.name}` : slug);

// One closing PR: `{ mergedAt, by }` once merged by a known author, else null.
async function mergedFix(exec: Exec, prSlug: string, prNumber: number): Promise<{ mergedAt: string; by: string } | null> {
  const pr = await readJson(() => exec(['pr', 'view', String(prNumber), '-R', prSlug, '--json', 'mergedAt,author']), ViewedPr);
  const mergedAt = toIso(pr?.mergedAt);
  return mergedAt && pr?.author?.login ? { mergedAt, by: pr.author.login } : null;
}

// The fallback: the timeline's last `closed` event, a fix by its actor when a commit closed it.
async function closedByCommit(exec: Exec, slug: string, number: number): Promise<string | null> {
  const closed = lines(await soft(exec(['api', `repos/${slug}/issues/${number}/timeline`, '--paginate', '--jq', '.[] | select(.event=="closed") | "\\(.commit_id) \\(.actor.login)"']))).at(-1);
  const [commitId, actor] = (closed ?? '').split(/\s+/);
  return commitId && commitId !== 'null' && actor && actor !== 'null' ? actor : null;
}

// F2: the sub-PR that stands for a zone. A sub-PR closed without merging is dropped (it freed the
// zone); among the rest the lowest number wins (spec §8). Once that one is reverted, the zone's next
// non-revert sub-PR opened after the revert — if there is one — takes over.
function zoneSub(subs: SubRow[], sliceId: string, reverts: ReadonlyMap<number, string>): SubRow | undefined {
  const live = subs
    .filter((s) => !/^revert/i.test(s.title) && s.headRefName.endsWith(`--${sliceId}`) && !(s.state === 'CLOSED' && !s.mergedAt))
    .sort((a, b) => a.number - b.number);
  let sub = live[0];
  for (let revertedAt = sub && reverts.get(sub.number); sub && revertedAt; revertedAt = reverts.get(sub.number)) {
    const current: SubRow = sub;
    const at = revertedAt;
    const next = live.find((s) => s.number > current.number && new Date(s.createdAt) > new Date(at));
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
async function needsFixHistory(exec: Exec, repoSlug: string, sub: SubRow, labels: string[]): Promise<NeedsFix | null> {
  const history = lines(await soft(exec(['api', `repos/${repoSlug}/issues/${sub.number}/timeline`, '--paginate', '--jq', NEEDS_FIX_JQ])))
    .map((l) => l.split(/\s+/)).map(([event, at]) => [event, toIso(at)] as const).filter(([event, at]) => (event === 'labeled' || event === 'unlabeled') && at);
  const labelled = labels.includes('omni:needs-fix');
  const firstLabel = history.find(([event]) => event === 'labeled')?.[1] ?? null;
  if (!firstLabel) return labelled ? { labeledAt: sub.createdAt, unlabeledAt: null } : null;
  const last = history.at(-1);
  return { labeledAt: firstLabel, unlabeledAt: !labelled && last?.[0] === 'unlabeled' ? last[1] : null };
}
