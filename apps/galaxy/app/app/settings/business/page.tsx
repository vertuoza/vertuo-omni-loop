import type { Metadata } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';
import '../../../../src/business/business.css';
import '../../../../src/agent-connect/tokens/connect.css';
import '../../../../src/agent-connect/questions/questions.css';
import { viewer } from '../../../../src/data/viewer';
import type { Workspace } from '../../../../src/data/workspace';
import { loadBusinessPage } from '../../../../src/business/load';
import { loadTokens } from '../../../../src/agent-connect/tokens/load';
import { loadQuestions } from '../../../../src/agent-connect/questions/load';
import {
  BusinessScreen, DEMO_CLAIMS, DEMO_PRODUCTS, DEMO_QUESTIONS, DEMO_TOKENS, type BusinessScreenView,
} from '../../../../src/business/BusinessScreen';

// /app/settings/business (PRD 748 s2): the workspace's business, under the app's shared top bar
// (app/app/layout.tsx). Any member picks what it sells, to whom, where and against whom, each pick a
// confirmed claim stored through the claim functions; agents read the confirmed ones with
// `omni business show`. Rendered per request, as the signed-in person, so row-level security decides
// what the read returns; opening it makes the business the first time. With the draft (PRD 774 s3), it
// also reads each claim's receipts, the web pages pasted and the latest draft; with Connect an agent
// (PRD 855 s1), the workspace's agent links; and the questions agents couldn't answer (PRD 855 s3), open
// ones only. The personas and the constituents are sections of the product's Knowledge home now (PRD 2240 s4).
// In development (or OMNI_LOOP_DEMO=1), the demo: a filled business, whose changes stay in the page.

/** The client, seen through the narrow rpc port the agent-connect loaders call. */
const rpcPortOf = (db: Pick<SupabaseClient, 'rpc'>) => ({
  rpc: (fn: string, args: Record<string, unknown>) => db.rpc(fn, args),
});

export const metadata: Metadata = { title: 'Business · OMNI LOOP' };

const demoView = (): BusinessScreenView => ({
  kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS,
  agents: { source: { kind: 'demo' }, tokens: DEMO_TOKENS },
  questions: { source: { kind: 'demo', lastSeq: Math.max(...DEMO_CLAIMS.map((c) => c.seq)) }, questions: DEMO_QUESTIONS, products: DEMO_PRODUCTS },
});

type Seen = Extract<Awaited<ReturnType<typeof viewer>>, { kind: 'signed-in' }>;

/** The workspace is the shared viewer's read (omni-loop-29 s2), one per request; a situation when there is none. */
async function workspaceOf(seen: Seen): Promise<Workspace | BusinessScreenView> {
  const workspace = await seen.workspace().catch((error: unknown) => {
    console.error(error);
    return undefined;
  });
  return workspace ?? { kind: workspace === null ? 'no-workspace' : 'unreadable' };
}

async function signedInView(seen: Seen): Promise<BusinessScreenView> {
  const workspace = await workspaceOf(seen);
  if ('kind' in workspace) return workspace;
  // The agents' tokens and questions start now and are never awaited here: only the claims block the
  // page, the two sections stream in on their own, each with a skeleton.
  const db = rpcPortOf(seen.db);
  const tokens = loadTokens(db, workspace.id);
  const asked = loadQuestions(db, workspace.id);
  const load = await loadBusinessPage(seen.db, seen.user);
  if (load.kind !== 'business') return load;
  const { products } = load;
  return {
    kind: 'business',
    source: { kind: 'database', ...seen.env, workspace: workspace.id, product: load.product.id },
    claims: load.claims,
    products,
    draft: load.draft,
    pages: load.pages,
    agents: tokens.then((list) => ({ source: { kind: 'database', workspace: workspace.id }, tokens: list })),
    questions: asked.then((list) => ({ source: { kind: 'database', ...seen.env, workspace: workspace.id }, questions: list, products })),
  };
}

async function viewOf(): Promise<BusinessScreenView> {
  const seen = await viewer();
  if (seen.kind === 'demo') return demoView();
  return seen.kind === 'signed-in' ? signedInView(seen) : { kind: seen.kind };
}

export default async function BusinessRoute() {
  return <BusinessScreen view={await viewOf()} />;
}
