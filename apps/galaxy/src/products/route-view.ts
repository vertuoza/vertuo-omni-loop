import { defaultPitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import type { MemberSession } from '../data/member-session';
import type { Approvers } from './approvers';
import type { ProductPageLoad } from './load';
import { DEMO_PRODUCTS, type ProductScreenView } from './ProductsScreen';

// What /app/settings/products/<id> draws (PRD 859 s1), from who reads it: the demo's product, the
// session's own situation (closed, sign-in), or the product as row-level security returns it, with its
// Pitch settings (PRD 1108 s2) and its Approvers list (PRD 1322 s1). The demo's products hold no
// settings, so each reads as its look's preset, and list nobody.

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;
type LoadProduct = (session: SignedIn, id: string) => Promise<ProductPageLoad>;

/** The demo's members, nobody listed yet: the reader owns the demo workspace, so they edit the list. */
export const DEMO_APPROVERS: Approvers = {
  owner: true,
  members: [
    { id: 'demo-irisa', name: 'Irisa', login: 'irisa' },
    { id: 'demo-paul', name: 'Paul', login: 'paul' },
    { id: 'demo-dev', name: 'Dev', login: 'dev' },
  ],
  listed: [],
};

function demoView(id: string): ProductScreenView {
  const product = DEMO_PRODUCTS.find((p) => p.id === id);
  if (!product) return { kind: 'not-found' };
  return { kind: 'product', source: { kind: 'demo' }, editable: true, product: { ...product, pitch: defaultPitchSettings(product.look) }, approvers: DEMO_APPROVERS };
}

export async function productViewOf(session: MemberSession, id: string, load: LoadProduct): Promise<ProductScreenView> {
  if (session.kind === 'demo') return demoView(id);
  if (session.kind !== 'signed-in') return session;
  const read = await load(session, id);
  if (read.kind !== 'product') return read;
  return {
    kind: 'product',
    source: { kind: 'database', ...session.env, workspace: read.workspace.id },
    editable: read.editable,
    product: read.product,
    approvers: read.approvers,
  };
}
