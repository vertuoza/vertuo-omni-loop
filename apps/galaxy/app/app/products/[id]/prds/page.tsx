import type { Metadata } from 'next';
import '../../../../../src/products/products.css';
import '../../../../../src/product-home/product-home.css';
import { memberSession } from '../../../../../src/data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../../../../../src/product-home/product-home.controller';
import { ProductHome } from '../../../../../src/product-home/ProductHome';

// /app/products/<id>/prds (PRD 1364 s9): the product home's PRDs tab, every PRD of the product, newest
// first, with its birthplace and state word. Rendered per request, as the signed-in person.

export const metadata: Metadata = { title: 'Product PRDs · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductPrdsRoute({ params }: Props) {
  const { id } = await params;
  return <ProductHome tab="prds" view={await productHomeViewOf(await memberSession(), id, LIVE_PRODUCT_HOME)} />;
}
