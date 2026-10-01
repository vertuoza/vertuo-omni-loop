// game/cli/dossiers.ts --workspace <slug> — the fallback of PRD dossiers (PRD 216): read each
// repository of the workspace's sectors, and its plan repository, on its default branch, and bring each
// PRD's dossier up to its delivery folder (game/dossiers/sync.ts). The ledger job runs it after
// game:project. A repository, a folder or a file it cannot read or store is skipped and logged, and the
// run still exits 0; only a workspace it cannot open stops it, as every game script (exit 2 on a usage
// mistake, 1 otherwise).
import { loadConfig, supabaseEnv } from '../sources/supabase.ts';
import { ghExec } from '../sources/github.ts';
import { dossierStore } from '../dossiers/store.ts';
import { syncDossiers } from '../dossiers/sync.ts';
import { openWorkspace } from './workspace.ts';

const { rest, workspace, github } = await openWorkspace({ usage: 'game:dossiers --workspace <slug>', github: true });
let repos: string[];
try {
  repos = [...new Set([...(await loadConfig(rest, workspace.id)).repos, github.planRepo])];
} catch (err) {
  console.error(err instanceof Error ? err.message : undefined);
  process.exit(1);
}
console.log(`workspace ${workspace.slug}: ${repos.length} repositories of ${github.org}, read on their default branch`);

const store = dossierStore(supabaseEnv());
const reports = await syncDossiers({ exec: ghExec, store, workspaceId: workspace.id, org: github.org, repos });

const read = reports.flatMap((r) => (r.skipped === undefined ? [r] : []));
const created = read.reduce((n, r) => n + r.created.length, 0);
const added = read.reduce((n, r) => n + r.added.length, 0);
console.log(`dossiers: ${read.length} of ${reports.length} repositories read · ${created} created · ${added} ${added === 1 ? 'version' : 'versions'} added`);
