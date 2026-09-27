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
// A folder whose name does not parse, a file over 512 KiB, a repository or a blob that cannot be read,
// and a PRD that cannot be stored are skipped and logged: nothing fails the run.
import { ARTIFACT_MAX_BYTES, CONFIG_FILE, deliveryFolders, dossierSwitch, gitBlobSha, titleOf } from './folders.mjs';
import { ghWhy, readBlob, readConfig, readHead, readTree } from './github.mjs';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Whether a tree's file differs from the latest stored version of its kind. */
async function changed(store, latest, file) {
  if (!latest) return true;
  if (latest.gitBlob) return latest.gitBlob !== file.sha;
  if (latest.bytes !== file.size) return true;
  const content = await store.content(latest.id); // the kit pushed it: hash what it stored
  return content === null || gitBlobSha(content) !== file.sha;
}

async function syncFolder({ exec, store, slug, homeRepo, workspaceId, head, folder, dossier, now, log, report }) {
  const wanted = [];
  for (const file of folder.files) if (await changed(store, dossier?.latest[file.kind], file)) wanted.push(file);
  if (dossier && !wanted.length) return;

  const contents = new Map();
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
    else contents.set(file.kind, content);
  }

  const title = titleOf(contents.get('spec') ?? null, folder.topic);
  if (!dossier) {
    // Null when the key was taken since the listing (a kit push in between): read the one there is.
    dossier = (await store.open({ workspaceId, homeRepo, prd: folder.prd, title, at: now.toISOString() }))
      ?? (await store.dossiersOf(workspaceId, homeRepo, folder.prd)).get(folder.prd);
    report.created.push(folder.prd);
  } else if (contents.has('spec') && title !== dossier.title) {
    await store.retitle(dossier.id, title);
  }

  for (const file of wanted) {
    if (!contents.has(file.kind)) continue;
    const version = await store.addVersion({ dossierId: dossier.id, kind: file.kind, content: contents.get(file.kind), commitSha: head.commit, gitBlob: file.sha });
    if (version !== null) report.added.push({ prd: folder.prd, kind: file.kind, version });
  }
}

async function syncRepository({ exec, store, workspaceId, slug, now, log }) {
  let head, config, listing;
  try {
    head = await readHead(exec, slug);
    config = await readConfig(exec, slug, head.commit);
    if (config === null) return skip(`no ${CONFIG_FILE} on ${head.branch}`);
    const switched = dossierSwitch(config);
    if (!switched.on) return skip(switched.reason);
    listing = { ...(await readTree(exec, slug, head.tree)), delivery: switched.delivery };
  } catch (err) {
    log.warn(`  ! skipped ${slug}: cannot be read: ${ghWhy(err)}`);
    return { slug, skipped: `cannot be read: ${ghWhy(err)}` };
  }

  function skip(reason) {
    log.log(`  - skipped ${slug}: ${reason}`);
    return { slug, skipped: reason };
  }

  if (listing.truncated) log.warn(`  ! ${slug}: the tree listing is truncated: folders past its end are not read`);
  const { folders, skipped } = deliveryFolders(listing.entries, listing.delivery);
  for (const { path, reason } of skipped) log.warn(`  ! skipped ${path} in ${slug}: ${reason}`);

  const homeRepo = slug.toLowerCase(); // GitHub's owner/name is not case-sensitive: the migration keeps it in lower case
  const report = { slug, commit: head.commit, folders: folders.length, created: [], added: [], fetched: 0 };
  let known = new Map();
  if (folders.length) {
    try {
      known = await store.dossiersOf(workspaceId, homeRepo);
    } catch (err) {
      log.warn(`  ! skipped ${slug}: its dossiers cannot be read: ${err.message}`);
      return { slug, skipped: `its dossiers cannot be read: ${err.message}` };
    }
  }
  for (const folder of folders) {
    try {
      await syncFolder({ exec, store, slug, homeRepo, workspaceId, head, folder, dossier: known.get(folder.prd), now, log, report });
    } catch (err) {
      log.warn(`  ! skipped PRD ${folder.prd} of ${slug}: ${err.message}`);
    }
  }

  const parts = [plural(folders.length, 'PRD folder')];
  if (report.created.length) parts.push(`${plural(report.created.length, 'dossier')} created`);
  if (report.fetched) parts.push(`${plural(report.fetched, 'file')} fetched`);
  parts.push(report.added.length ? `added: ${report.added.map((a) => `#${a.prd} ${a.kind} v${a.version}`).join(', ')}` : 'nothing added');
  log.log(`${slug} @ ${head.commit.slice(0, 8)} (${head.branch}): ${parts.join(' · ')}`);
  return report;
}

/**
 * Brings the workspace's dossiers up to each repository's default branch.
 * @param {{ exec: (args: string[]) => Promise<string>, store: ReturnType<import('./store.mjs').dossierStore>,
 *   workspaceId: string, org: string, repos: string[], now?: Date, log?: Pick<Console, 'log' | 'warn'> }} run
 * @returns {Promise<Array<{ slug: string, skipped: string } | { slug: string, commit: string, folders: number,
 *   created: number[], added: Array<{ prd: number, kind: string, version: number }>, fetched: number }>>}
 *   one report per repository, in order, each read once
 */
export async function syncDossiers({ exec, store, workspaceId, org, repos, now = new Date(), log = console }) {
  const reports = [];
  for (const repo of [...new Set(repos)]) {
    reports.push(await syncRepository({ exec, store, workspaceId, slug: `${org}/${repo}`, now, log }));
  }
  return reports;
}
