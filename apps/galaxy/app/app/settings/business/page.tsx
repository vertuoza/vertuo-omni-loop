import type { Metadata } from 'next';
import '../../../../src/business/business.css';
import '../../../../src/business/never.css';
import '../../../../src/agent-connect/tokens/connect.css';
import { memberSession } from '../../../../src/data/member-session';
import { loadBusinessPage } from '../../../../src/business/load';
import { loadTokens } from '../../../../src/agent-connect/tokens/load';
import { BusinessScreen, DEMO_CLAIMS, DEMO_PERSONAS, DEMO_PRODUCTS, DEMO_TOKENS, type BusinessScreenView } from '../../../../src/business/BusinessScreen';

// /app/settings/business (PRD 748 s2): the workspace's business, under the app's shared top bar
// (app/app/layout.tsx). Any member picks what it sells, to whom, where and against whom, each pick a
// confirmed claim stored through the claim functions; agents read the confirmed ones with
// `omni business show`. Rendered per request, as the signed-in person, so row-level security decides
// what the read returns; opening it makes the business the first time. With the draft (PRD 774 s3), it
// also reads each claim's receipts, the web pages pasted and the latest draft; with the personas
// (PRD 799 s3), each product's cast; with Connect an agent (PRD 855 s1), the workspace's agent links.
// In development (or OMNI_LOOP_DEMO=1), the demo: a filled business, whose changes stay in the page.

export const metadata: Metadata = { title: 'Business · OMNI LOOP' };

async function viewOf(): Promise<BusinessScreenView> {
  const session = await memberSession();
  if (session.kind === 'demo') {
    return {
      kind: 'business', source: { kind: 'demo' }, claims: DEMO_CLAIMS, products: DEMO_PRODUCTS, personas: DEMO_PERSONAS,
      agents: { source: { kind: 'demo' }, tokens: DEMO_TOKENS },
    };
  }
  if (session.kind !== 'signed-in') return session;
  const load = await loadBusinessPage(session.db, session.user);
  if (load.kind !== 'business') return load;
  const tokens = await loadTokens(session.db as unknown as Parameters<typeof loadTokens>[0], load.workspace.id);
  return {
    kind: 'business',
    source: { kind: 'database', ...session.env, workspace: load.workspace.id, product: load.product.id },
    claims: load.claims,
    products: load.products,
    draft: load.draft,
    pages: load.pages,
    personas: load.personas,
    agents: { source: { kind: 'database', workspace: load.workspace.id }, tokens },
  };
}

export default async function BusinessRoute() {
  return <BusinessScreen view={await viewOf()} />;
}
