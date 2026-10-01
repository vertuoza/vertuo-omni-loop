// @ts-nocheck
// game/cli/dossiers.ts --workspace <slug> — the fallback of PRD dossiers (PRD 216): read each
// repository of the workspace's sectors, and its plan repository, on its default branch, and bring each
// PRD's dossier up to its delivery folder (game/dossiers/sync.ts). The ledger job runs it after
// game:project. A repository, a folder or a file it cannot read or store is skipped and logged, and the
// run still exits 0; only a workspace it cannot open stops it, as every game script (exit 2 on a usage
// mistake, 1 otherwise).
import { loadConfig } from '../sources/supabase.ts';
import { ghExec } from '../sources/github.ts';
import { dossierStore } from '../dossiers/store.ts';
import { syncDossiers } from '../dossiers/sync.ts';
import { openWorkspace } from './workspace.ts';

const { rest, workspace, github } = await openWorkspace({ usage: 'game:dossiers --workspace <slug>', github: true });
let repos;
try {
  repos = [...new Set([...(await loadConfig(rest, workspace.id)).repos, github.planRepo])];
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
console.log(`workspace ${workspace.slug}: ${repos.length} repositories of ${github.org}, read on their default branch`);

const store = dossierStore({ url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const reports = await syncDossiers({ exec: ghExec, store, workspaceId: workspace.id, org: github.org, repos });

const read = reports.filter((r) => !r.skipped);
const created = read.reduce((n, r) => n + r.created.length, 0);
const added = read.reduce((n, r) => n + r.added.length, 0);
console.log(`dossiers: ${read.length} of ${reports.length} repositories read · ${created} created · ${added} ${added === 1 ? 'version' : 'versions'} added`);
