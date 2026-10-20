import { NextResponse, type NextRequest } from 'next/server';
import { pitchMovedTo } from '../../../../../src/product-knowledge/pitch/moved';

// /app/settings/products/<id>, where a product's Pitch settings lived until PRD 2240: a permanent redirect
// to the product's Knowledge › Pitch, the query kept (src/product-knowledge/pitch/moved.ts).

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(pitchMovedTo(request.nextUrl, id), 308);
}
