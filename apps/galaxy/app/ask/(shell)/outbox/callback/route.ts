import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../../../src/ask/page/sign-in';
import { outboxSignInReturn } from '../../../../../src/outbox-items/outbox-questions-live';

// Where Google sends the person back after signing in on Outbox: the code becomes the session cookie,
// then back to Outbox (src/outbox-items/outbox-questions-live.ts).

export async function GET(request: NextRequest) {
  return NextResponse.redirect(await outboxSignInReturn(request.nextUrl, requestOrigin(request)));
}
