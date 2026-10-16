import type { Metadata } from 'next';
import '../../../../src/public-api/page/api-keys.css';
import { memberSession } from '../../../../src/data/member-session';
import { demoApiKeysView } from '../../../../src/public-api/page/demo';
import { apiKeysPageReads } from '../../../../src/public-api/page/live';
import { loadApiKeysPage } from '../../../../src/public-api/page/load';
import type { ApiKeysPageView } from '../../../../src/public-api/page/model';
import { ApiKeysPage } from '../../../../src/public-api/page/ApiKeysPage';

// /app/settings/api-keys (PRD 2022 s1): the workspace's API keys, under the app's shared top bar
// (app/app/layout.tsx). An owner makes a key, sees its secret once, and revokes it, through
// /api/api-keys; every member reads the list, never a secret nor a hash. Rendered per request, as the
// signed-in person, so the database decides what the read returns. In development (or
// OMNI_LOOP_DEMO=1), the demo: an owner with two keys, whose changes stay in the page.

export const metadata: Metadata = { title: 'API keys · OMNI LOOP', robots: { index: false, follow: false } };

async function viewOf(): Promise<ApiKeysPageView> {
  const session = await memberSession();
  if (session.kind === 'demo') return demoApiKeysView();
  if (session.kind !== 'signed-in') return session;
  return loadApiKeysPage(apiKeysPageReads(session.db, session.user));
}

export default async function ApiKeysRoute() {
  return <ApiKeysPage view={await viewOf()} now={new Date().toISOString()} />;
}
