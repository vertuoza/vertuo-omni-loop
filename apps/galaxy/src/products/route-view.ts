import { defaultPitchSettings } from 'vertuo-omni-plan/kit/lib/pitch/settings.ts';
import type { MemberSession } from '../data/member-session';
import type { ProductLoad } from './load';
import { DEMO_PRODUCTS, type ProductScreenView } from './ProductsScreen';

// What /app/settings/products/<id> draws (PRD 859 s1), from who reads it: the demo's product, the
// session's own situation (closed, sign-in), or the product as row-level security returns it, with its
// Pitch settings (PRD 1108 s2). The demo's products hold none, so each reads as its look's preset.

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;
type LoadProduct = (session: SignedIn, id: string) => Promise<ProductLoad>;

function demoView(id: string): ProductScreenView {
  const product = DEMO_PRODUCTS.find((p) => p.id === id);
  if (!product) return { kind: 'not-found' };
  return { kind: 'product', source: { kind: 'demo' }, editable: true, product: { ...product, pitch: defaultPitchSettings(product.look) } };
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
  };
}
