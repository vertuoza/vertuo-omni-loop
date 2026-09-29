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
import { ARTIFACT_MAX_BYTES, CONFIG_FILE, deliveryFolders, dossierSwitch, fixFolders, fixTitle, gitBlobSha, titleOf } from './folders.mjs';
import { ghWhy, readBlob, readConfig, readHead, readIssueTitle, readTree } from './github.mjs';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const FIX_KINDS = ['visual', 'bug'];
const FIX_NAMES = { visual: 'visual fix', bug: 'bug fix' };

/** Whether a stored version holds the tree's file: by its blob hash, else by hashing what the kit stored. */
async function holds(store, stored, file) {
  if (stored.gitBlob) return stored.gitBlob === file.sha;
  if (stored.bytes !== file.size) return false;
  const content = await store.content(stored.id); // the kit pushed it: hash what it stored
  return content !== null && gitBlobSha(content) === file.sha;
}

/** Whether a tree's file differs from what the dossier holds: the latest of its kind, or any round. */
async function changed(store, dossier, file) {
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
async function syncFolder({ exec, store, slug, homeRepo, workspaceId, head, folder, kind, dossier, now, log, report, name, retitle, created, added }) {
  const wanted = [];
  for (const file of folder.files) if (await changed(store, dossier, file)) wanted.push(file);
  if (dossier && !wanted.length) return;

  const contents = new Map(); // path → content
  for (const file of wanted) {
    let content;
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
  const byKind = (k) => {
    const file = wanted.find((f) => f.kind === k && contents.has(f.path));
    return file ? contents.get(file.path) : null;
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

  for (const file of wanted) {
    if (!contents.has(file.path)) continue;
    try {
      const version = await store.addVersion({ dossierId: dossier.id, kind: file.kind, content: contents.get(file.path), commitSha: head.commit, gitBlob: file.sha });
      if (version !== null) added(file.kind, version);
    } catch (err) {
      log.warn(`  ! skipped ${file.path} in ${slug}: ${err.message}`);
    }
  }
}

/** A fix's title: its issue's, without its prefix, else its folder's topic (logged when the issue cannot be read). */
async function fixName({ exec, slug, folder, log }) {
  let issueTitle = null;
  try {
    issueTitle = await readIssueTitle(exec, slug, folder.prd);
  } catch (err) {
    log.warn(`  ! ${slug}: the title of issue ${folder.prd} cannot be read (${ghWhy(err)}): titled ${fixTitle(null, folder.topic)}`);
  }
  return fixTitle(issueTitle, folder.topic);
}

async function syncFixes({ exec, store, slug, homeRepo, workspaceId, head, folders, now, log, report }) {
  const fixes = { folders: folders.length, created: [], added: [] };
  for (const kind of FIX_KINDS) {
    const ofKind = folders.filter((f) => f.kind === kind);
    if (!ofKind.length) continue;
    let known;
    try {
      known = await store.dossiersOf(workspaceId, homeRepo, null, { kind });
    } catch (err) {
      log.warn(`  ! skipped the ${FIX_NAMES[kind]}es of ${slug}: their dossiers cannot be read: ${err.message}`);
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
        log.warn(`  ! skipped ${FIX_NAMES[kind]} ${folder.prd} of ${slug}: ${err.message}`);
      }
    }
  }
  return fixes;
}

async function syncRepository({ exec, store, workspaceId, slug, now, log }) {
  // A repository that has not switched dossiers on is expected; one that cannot be read is logged as a problem.
  const skip = (reason, problem = false) => {
    if (problem) log.warn(`  ! skipped ${slug}: ${reason}`);
    else log.log(`  - skipped ${slug}: ${reason}`);
    return { slug, skipped: reason };
  };
  let head, listing;
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
  const report = { slug, commit: head.commit, folders: folders.length, created: [], added: [], fetched: 0 };
  let known = new Map();
  if (folders.length) {
    try {
      known = await store.dossiersOf(workspaceId, homeRepo);
    } catch (err) {
      return skip(`its dossiers cannot be read: ${err.message}`, true);
    }
  }
  await syncPrds({ exec, store, slug, homeRepo, workspaceId, head, folders, known, now, log, report });
  if (fixed.folders.length) {
    report.fixes = await syncFixes({ exec, store, slug, homeRepo, workspaceId, head, folders: fixed.folders, now, log, report });
  }
  logReport({ slug, head, folders, report, log });
  return report;
}

async function syncPrds({ exec, store, slug, homeRepo, workspaceId, head, folders, known, now, log, report }) {
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
      log.warn(`  ! skipped PRD ${folder.prd} of ${slug}: ${err.message}`);
    }
  }
}

/** One line per repository: its folders, the dossiers created, the files fetched and the versions added. */
function logReport({ slug, head, folders, report, log }) {
  const fixes = report.fixes ?? { folders: 0, created: [], added: [] };
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
 * Brings the workspace's dossiers up to each repository's default branch.
 * @param {{ exec: (args: string[]) => Promise<string>, store: ReturnType<import('./store.mjs').dossierStore>,
 *   workspaceId: string, org: string, repos: string[], now?: Date, log?: Pick<Console, 'log' | 'warn'> }} run
 * @returns {Promise<Array<{ slug: string, skipped: string } | { slug: string, commit: string, folders: number,
 *   created: number[], added: Array<{ prd: number, kind: string, version: number }>, fetched: number,
 *   fixes?: { folders: number, created: Array<{ kind: 'visual' | 'bug', prd: number }>,
 *     added: Array<{ fix: 'visual' | 'bug', prd: number, kind: string, version: number }> } }>>}
 *   one report per repository, in order, each read once; `fixes` only when it holds a fix folder
 */
export async function syncDossiers({ exec, store, workspaceId, org, repos, now = new Date(), log = console }) {
  const reports = [];
  for (const repo of [...new Set(repos)]) {
    reports.push(await syncRepository({ exec, store, workspaceId, slug: `${org}/${repo}`, now, log }));
  }
  return reports;
}
