// `pnpm game:dossiers`'s run (PRD 216, spec › The fallback): for each repository of the workspace, read
// its default branch's delivery folders and bring each PRD's dossier up to them.
//
// Per repository: the head of the default branch; the config at that commit (no config, or the switch
// off, and the repository is skipped); one recursive tree listing, read as PRD folders. Per folder: a
// file is fetched only when its blob differs from the one the dossier's latest version of its kind was
// read at, so a second run with no change fetches nothing. A version the kit pushed carries no blob
// hash: when its size matches, its stored content is hashed as git would to compare, rather than
// fetched again from GitHub. Then the dossier is found, or created with the spec's title or else the
// topic, retitled when a changed spec names another title, and each fetched file goes through the
// version rule (dossier_add_version()) with source `github`, the head commit and the blob hash.
//
// The same listing is also read as fixes (PRD 627): `<delivery>/visual/` and `<delivery>/bugs/` give
// `visual` and `bug` dossiers, keyed by their issue's number. A fix's before/after page and bug record
// are compared as a PRD's files are; a round of variations is fetched only when no round already
// stored matches it. A fix's dossier is titled, once, when it is opened: after its issue's title (read
// then, and only then), else its folder's topic.
//
// A folder whose name does not parse, a file over 512 KiB, a repository or a blob that cannot be read,
// and a PRD or a fix that cannot be stored are skipped and logged: nothing fails the run.
import { ARTIFACT_MAX_BYTES, CONFIG_FILE, deliveryFolders, dossierSwitch, fixFolders, fixTitle, gitBlobSha, titleOf, type FixFile, type FixFolder, type PrdFolder, type TreeEntry, type TreeFile } from './folders.ts';
import { ghWhy, readBlob, readConfig, readHead, readIssueTitle, readTree } from './github.ts';
import type { Exec } from '../sources/github.ts';
import type { Dossier, DossierStore, DossierVersion } from './store.ts';
import type { IssueNumber, PrdNumber } from '../../kit/lib/ids.ts';

type Log = Pick<Console, 'log' | 'warn'>;
type Head = { branch: string; commit: string; tree: string };
type File = TreeFile | FixFile;
type ByKind = (kind: string) => string | null;
type FixKind = FixFolder['kind'];

/** What one run of a repository's fixes did. */
export type FixesReport = {
  folders: number;
  created: Array<{ kind: FixKind; prd: IssueNumber }>;
  added: Array<{ fix: FixKind; prd: IssueNumber; kind: string; version: number }>;
};
/** What one run did to a repository it read. */
export type RepositoryReport = {
  slug: string;
  commit: string;
  folders: number;
  created: PrdNumber[];
  added: Array<{ prd: PrdNumber; kind: string; version: number }>;
  fetched: number;
  fixes?: FixesReport;
  skipped?: undefined;
};
/** A repository the run did not read, and why. */
export type SkippedReport = { slug: string; skipped: string };

// What a thrown value says.
const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const FIX_KINDS: FixKind[] = ['visual', 'bug'];
const FIX_NAMES: Record<FixKind, string> = { visual: 'visual fix', bug: 'bug fix' };

/** Whether a stored version holds the tree's file: by its blob hash, else by hashing what the kit stored. */
async function holds(store: DossierStore, stored: DossierVersion, file: File): Promise<boolean> {
  if (stored.gitBlob) return stored.gitBlob === file.sha;
  if (stored.bytes !== file.size) return false;
  const content = await store.content(stored.id); // the kit pushed it: hash what it stored
  return content !== null && gitBlobSha(content) === file.sha;
}

/** Whether a tree's file differs from what the dossier holds: the latest of its kind, or any round. */
async function changed(store: DossierStore, dossier: Dossier | null | undefined, file: File): Promise<boolean> {
  if (file.kind === 'variations') {
    for (const round of dossier?.rounds ?? []) if (await holds(store, round, file)) return false;
    return true;
  }
  const latest = dossier?.latest[file.kind];
  return !latest || !(await holds(store, latest, file));
}

/**
 * Brings one folder's dossier up to the tree: fetches what changed, opens the dossier when there is
 * none (`name(contents)` gives its title), and adds each fetched file through the version rule.
 * `retitle(contents)` gives a title to set on a found dossier, or null. Reports through `created()` and
 * `added(kind, version)`.
 */
async function syncFolder({ exec, store, slug, homeRepo, workspaceId, head, folder, kind, dossier, now, log, report, name, retitle, created, added }: {
  exec: Exec; store: DossierStore; slug: string; homeRepo: string; workspaceId: string; head: Head;
  folder: { prd: PrdNumber | IssueNumber; files: readonly File[] }; kind: string; dossier: Dossier | null | undefined; now: Date; log: Log;
  report: { fetched: number }; name: (byKind: ByKind) => string | Promise<string>; retitle: (byKind: ByKind) => string | null;
  created: () => void; added: (kind: string, version: number) => void;
}): Promise<void> {
  const wanted: File[] = [];
  for (const file of folder.files) if (await changed(store, dossier, file)) wanted.push(file);
  if (dossier && !wanted.length) return;

  const contents = new Map<string, string>(); // path → content
  for (const file of wanted) {
    let content: string;
    try {
      content = await readBlob(exec, slug, file.sha);
    } catch (err) {
      log.warn(`  ! skipped ${file.path} in ${slug}: cannot be read: ${ghWhy(err)}`);
      continue;
    }
    report.fetched += 1;
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > ARTIFACT_MAX_BYTES) log.warn(`  ! skipped ${file.path} in ${slug}: ${bytes} bytes, over 512 KiB`);
    else contents.set(file.path, content);
  }
  const byKind: ByKind = (k) => {
    const file = wanted.find((f) => f.kind === k && contents.has(f.path));
    return file ? contents.get(file.path) ?? null : null;
  };

  if (!dossier) {
    dossier = await store.open({ workspaceId, homeRepo, kind, prd: folder.prd, title: await name(byKind), at: now.toISOString() });
    if (dossier) created();
    // Null when the key was taken since the listing (a kit push in between): take the one there is.
    else dossier = (await store.dossiersOf(workspaceId, homeRepo, folder.prd, { kind })).get(folder.prd);
    if (!dossier) throw new Error('its dossier could be neither opened nor found');
  } else {
    const title = retitle(byKind);
    if (title !== null && title !== dossier.title) await store.retitle(dossier.id, title);
  }

  const found: Dossier = dossier;
  for (const file of wanted) {
    const content = contents.get(file.path);
    if (content === undefined) continue;
    try {
      const version = await store.addVersion({ dossierId: found.id, kind: file.kind, content, commitSha: head.commit, gitBlob: file.sha });
      if (version !== null) added(file.kind, version);
    } catch (err) {
      log.warn(`  ! skipped ${file.path} in ${slug}: ${messageOf(err)}`);
    }
  }
}

/** A fix's title: its issue's, without its prefix, else its folder's topic (logged when the issue cannot be read). */
async function fixName({ exec, slug, folder, log }: { exec: Exec; slug: string; folder: FixFolder; log: Log }): Promise<string> {
  let issueTitle: string | null = null;
  try {
    issueTitle = await readIssueTitle(exec, slug, folder.prd);
  } catch (err) {
    log.warn(`  ! ${slug}: the title of issue ${folder.prd} cannot be read (${ghWhy(err)}): titled ${fixTitle(null, folder.topic)}`);
  }
  return fixTitle(issueTitle, folder.topic);
}

async function syncFixes({ exec, store, slug, homeRepo, workspaceId, head, folders, now, log, report }: {
  exec: Exec; store: DossierStore; slug: string; homeRepo: string; workspaceId: string; head: Head; folders: FixFolder[]; now: Date; log: Log; report: { fetched: number };
}): Promise<FixesReport> {
  const fixes: FixesReport = { folders: folders.length, created: [], added: [] };
  for (const kind of FIX_KINDS) {
    const ofKind = folders.filter((f) => f.kind === kind);
    if (!ofKind.length) continue;
    let known: Map<number, Dossier>;
    try {
      known = await store.dossiersOf(workspaceId, homeRepo, null, { kind });
    } catch (err) {
      log.warn(`  ! skipped the ${FIX_NAMES[kind]}es of ${slug}: their dossiers cannot be read: ${messageOf(err)}`);
      continue;
    }
    for (const folder of ofKind) {
      try {
        await syncFolder({
          exec, store, slug, homeRepo, workspaceId, head, folder, kind, dossier: known.get(folder.prd), now, log, report,
          name: () => fixName({ exec, slug, folder, log }),
          retitle: () => null,
          created: () => fixes.created.push({ kind, prd: folder.prd }),
          added: (artifact, version) => fixes.added.push({ fix: kind, prd: folder.prd, kind: artifact, version }),
        });
      } catch (err) {
        log.warn(`  ! skipped ${FIX_NAMES[kind]} ${folder.prd} of ${slug}: ${messageOf(err)}`);
      }
    }
  }
  return fixes;
}

async function syncRepository({ exec, store, workspaceId, slug, now, log }: { exec: Exec; store: DossierStore; workspaceId: string; slug: string; now: Date; log: Log }): Promise<RepositoryReport | SkippedReport> {
  // A repository that has not switched dossiers on is expected; one that cannot be read is logged as a problem.
  const skip = (reason: string, problem = false): SkippedReport => {
    if (problem) log.warn(`  ! skipped ${slug}: ${reason}`);
    else log.log(`  - skipped ${slug}: ${reason}`);
    return { slug, skipped: reason };
  };
  let head: Head, listing: { entries: TreeEntry[]; truncated: boolean; delivery: string };
  try {
    head = await readHead(exec, slug);
    const config = await readConfig(exec, slug, head.commit);
    if (config === null) return skip(`no ${CONFIG_FILE} on ${head.branch}`);
    const switched = dossierSwitch(config);
    if (!switched.on) return skip(switched.reason);
    listing = { ...(await readTree(exec, slug, head.tree)), delivery: switched.delivery };
  } catch (err) {
    return skip(`cannot be read: ${ghWhy(err)}`, true);
  }

  if (listing.truncated) log.warn(`  ! ${slug}: the tree listing is truncated: folders past its end are not read`);
  const { folders, skipped } = deliveryFolders(listing.entries, listing.delivery);
  const fixed = fixFolders(listing.entries, listing.delivery);
  for (const { path, reason } of [...skipped, ...fixed.skipped]) log.warn(`  ! skipped ${path} in ${slug}: ${reason}`);

  const homeRepo = slug.toLowerCase(); // GitHub's owner/name is not case-sensitive: the migration keeps it in lower case
  const report: RepositoryReport = { slug, commit: head.commit, folders: folders.length, created: [], added: [], fetched: 0 };
  let known = new Map<number, Dossier>();
  if (folders.length) {
    try {
      known = await store.dossiersOf(workspaceId, homeRepo);
    } catch (err) {
      return skip(`its dossiers cannot be read: ${messageOf(err)}`, true);
    }
  }
  await syncPrds({ exec, store, slug, homeRepo, workspaceId, head, folders, known, now, log, report });
  if (fixed.folders.length) {
    report.fixes = await syncFixes({ exec, store, slug, homeRepo, workspaceId, head, folders: fixed.folders, now, log, report });
  }
  logReport({ slug, head, folders, report, log });
  return report;
}

async function syncPrds({ exec, store, slug, homeRepo, workspaceId, head, folders, known, now, log, report }: {
  exec: Exec; store: DossierStore; slug: string; homeRepo: string; workspaceId: string; head: Head; folders: PrdFolder[]; known: Map<number, Dossier>; now: Date; log: Log; report: RepositoryReport;
}): Promise<void> {
  for (const folder of folders) {
    try {
      await syncFolder({
        exec, store, slug, homeRepo, workspaceId, head, folder, kind: 'prd', dossier: known.get(folder.prd), now, log, report,
        name: (byKind) => titleOf(byKind('spec'), folder.topic),
        retitle: (byKind) => (byKind('spec') === null ? null : titleOf(byKind('spec'), folder.topic)),
        created: () => report.created.push(folder.prd),
        added: (kind, version) => report.added.push({ prd: folder.prd, kind, version }),
      });
    } catch (err) {
      log.warn(`  ! skipped PRD ${folder.prd} of ${slug}: ${messageOf(err)}`);
    }
  }
}

/** One line per repository: its folders, the dossiers created, the files fetched and the versions added. */
function logReport({ slug, head, folders, report, log }: { slug: string; head: Head; folders: PrdFolder[]; report: RepositoryReport; log: Log }): void {
  const fixes: FixesReport = report.fixes ?? { folders: 0, created: [], added: [] };
  const parts = [plural(folders.length, 'PRD folder')];
  if (fixes.folders) parts.push(plural(fixes.folders, 'fix folder'));
  const createdCount = report.created.length + fixes.created.length;
  if (createdCount) parts.push(`${plural(createdCount, 'dossier')} created`);
  if (report.fetched) parts.push(`${plural(report.fetched, 'file')} fetched`);
  const added = [
    ...report.added.map((a) => `#${a.prd} ${a.kind} v${a.version}`),
    ...fixes.added.map((a) => `${a.fix} #${a.prd} ${a.kind} v${a.version}`),
  ];
  parts.push(added.length ? `added: ${added.join(', ')}` : 'nothing added');
  log.log(`${slug} @ ${head.commit.slice(0, 8)} (${head.branch}): ${parts.join(' · ')}`);
}

/**
 * Brings the workspace's dossiers up to each repository's default branch: one report per repository,
 * in order, each read once; `fixes` only when it holds a fix folder.
 */
export async function syncDossiers(
  { exec, store, workspaceId, org, repos, now = new Date(), log = console }: { exec: Exec; store: DossierStore; workspaceId: string; org: string; repos: readonly string[]; now?: Date; log?: Log },
): Promise<Array<RepositoryReport | SkippedReport>> {
  const reports: Array<RepositoryReport | SkippedReport> = [];
  for (const repo of [...new Set(repos)]) {
    reports.push(await syncRepository({ exec, store, workspaceId, slug: `${org}/${repo}`, now, log }));
  }
  return reports;
}
