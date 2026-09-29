import type { Metadata } from 'next';
import '../../../../src/repositories/repositories.css';
import { arcadeMode } from '../../../../src/data/mode';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';
import type { RepositoryRow } from '../../../../src/repositories/model';
import { loadRepositoriesPage, type RepositoriesApp } from '../../../../src/repositories/load';
import { RepositoriesScreen, type RepositoriesScreenView } from '../../../../src/repositories/RepositoriesScreen';
import { appCredentials, githubApp, installUrl } from '../../../../src/signup/github-app';

// /app/settings/repositories (PRD 612 s1): the workspace's repositories, under the app's shared top
// bar (app/app/layout.tsx). Its owner adds one from the repositories the workspace's Omni App
// installation can see, and switches tracking, through the owner-only repository functions; every
// other member reads the list. Rendered per request, as the signed-in person, so row-level security
// decides what the read returns; the App's installation is read with galaxy's own App credentials,
// server side only. In development (or OMNI_LOOP_DEMO=1), the demo: an owner with two repositories,
// whose changes stay in the page.

export const metadata: Metadata = { title: 'Repositories · OMNI LOOP' };

const DEMO: RepositoryRow[] = [
  { fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null },
  { fullName: 'acme/legacy', tracked: false, collectedAt: null, collectError: null },
];

/** galaxy's App client, or null when this deployment has no App credentials. */
function appOrNull(): RepositoriesApp | null {
  try {
    return githubApp(appCredentials());
  } catch (err) {
    console.error(`repositories: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function viewOf(): Promise<RepositoriesScreenView> {
  const now = Date.now();
  const mode = arcadeMode(process.env);
  if (mode === 'demo') {
    return {
      kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: DEMO, now,
      access: { kind: 'installed', settingsUrl: null, reachable: ['acme/widgets', 'acme/legacy', 'acme/new-thing'] },
    };
  }
  const env = supabaseEnv();
  if (mode === 'closed' || !env) return { kind: 'closed' };
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { kind: 'sign-in' };
  const load = await loadRepositoriesPage(db, user, appOrNull(), installUrl(process.env.GITHUB_APP_SLUG));
  if (load.kind !== 'repositories') return load;
  return {
    kind: 'repositories', source: { kind: 'database', ...env, workspace: load.workspace.id },
    owner: load.owner, repositories: load.repositories, access: load.access, now,
  };
}

export default async function RepositoriesRoute() {
  return <RepositoriesScreen view={await viewOf()} />;
}
