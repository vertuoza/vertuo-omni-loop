import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../../../src/products/products.css';
import '../../../../../src/product-home/product-home.css';
import { memberSession } from '../../../../../src/data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../../../../../src/product-home/product-home.controller';
import { ProductHome } from '../../../../../src/product-home/ProductHome';
import { productHomeTabOf } from '../../../../../src/product-home/tabs';

// /app/products/<id>/<tab> (PRD 1364 s10): the product home's Ideas, Roadmap, Bug fixes, Visual fixes and
// Questions tabs, each listing only the product's own (src/product-home/tabs.ts names their segments). The
// PRDs tab keeps its own route beside this one (s9), which Next.js matches first. A segment no tab has is
// not found. Rendered per request, as the signed-in person, so row-level security decides what the reads
// return.

export const metadata: Metadata = { title: 'Product · OMNI LOOP' };

type Props = { params: Promise<{ id: string; tab: string }> };

export default async function ProductTabRoute({ params }: Props) {
  const { id, tab: segment } = await params;
  const tab = productHomeTabOf(segment);
  if (tab === null) notFound();
  return <ProductHome tab={tab} view={await productHomeViewOf(await memberSession(), id, LIVE_PRODUCT_HOME)} />;
}
