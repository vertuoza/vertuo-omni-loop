import type { Metadata } from 'next';
import '../../../../src/repositories/repositories.css';
import { memberSession } from '../../../../src/data/member-session';
import type { RepositoryRow } from '../../../../src/repositories/model';
import { loadRepositoriesPage, type RepositoriesApp } from '../../../../src/repositories/load';
import { RepositoriesScreen, type RepositoriesScreenView } from '../../../../src/repositories/RepositoriesScreen';
import { appCredentials, githubApp, installUrl } from '../../../../src/signup/github-app';
import { serverEnv } from '../../../../src/env';

// /app/settings/repositories (PRD 612 s1): the workspace's repositories, under the app's shared top
// bar (app/app/layout.tsx). Its owner adds one from the repositories the workspace's Omni App
// installation can see, and switches tracking, through the owner-only repository functions; every
// other member reads the list. Rendered per request, as the signed-in person, so row-level security
// decides what the read returns; the App's installation is read with galaxy's own App credentials,
// server side only. In development (or OMNI_LOOP_DEMO=1), the demo: an owner with two repositories,
// whose changes stay in the page.

export const metadata: Metadata = { title: 'Repositories · OMNI LOOP' };

const DEMO: RepositoryRow[] = [
  { fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, product: 'demo-product-1' },
  { fullName: 'acme/legacy', tracked: false, collectedAt: null, collectError: null, product: 'demo-product-2' },
];

/** The demo's two products (PRD 748 s4), so each row shows its product select. */
const DEMO_PRODUCTS = [{ id: 'demo-product-1', name: 'Widgets' }, { id: 'demo-product-2', name: 'Legacy' }];

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
  const session = await memberSession();
  if (session.kind === 'demo') {
    return {
      kind: 'repositories', source: { kind: 'demo' }, owner: true, repositories: DEMO, products: DEMO_PRODUCTS, now,
      access: { kind: 'installed', settingsUrl: null, reachable: ['acme/widgets', 'acme/legacy', 'acme/new-thing'] },
    };
  }
  if (session.kind !== 'signed-in') return session;
  const load = await loadRepositoriesPage(session.db, session.user, appOrNull(), installUrl(serverEnv().githubAppSlug));
  if (load.kind !== 'repositories') return load;
  return {
    kind: 'repositories', source: { kind: 'database', ...session.env, workspace: load.workspace.id },
    owner: load.owner, repositories: load.repositories, access: load.access, products: load.products, now,
  };
}

export default async function RepositoriesRoute() {
  return <RepositoriesScreen view={await viewOf()} />;
}
