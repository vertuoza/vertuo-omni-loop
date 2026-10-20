import { NextResponse, type NextRequest } from 'next/server';
import { productsMovedTo } from '../../../../src/product-knowledge/pitch/moved';

// /app/settings/products, where the workspace's products were listed until PRD 2240: a permanent redirect
// to /app/products, the query kept (src/product-knowledge/pitch/moved.ts).

export function GET(request: NextRequest) {
  return NextResponse.redirect(productsMovedTo(request.nextUrl), 308);
}
