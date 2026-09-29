import { NextResponse, type NextRequest } from 'next/server';
import { fleetsMovedTo } from '../../../src/fleets/moved';

// /app/fleets, where the fleets page lived until PRD 572: a permanent redirect to
// /app/settings/fleets, the query kept (src/fleets/moved.ts).

export function GET(request: NextRequest) {
  return NextResponse.redirect(fleetsMovedTo(request.nextUrl), 308);
}
