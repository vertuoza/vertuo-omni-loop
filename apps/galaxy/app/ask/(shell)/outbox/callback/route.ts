import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin, signInBackTo } from '../../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../../src/data/supabase-server';
import { OUTBOX_PATH } from '../../../../../src/outbox-items/outbox-questions';

// Where Google sends the person back after signing in on Outbox: the code becomes the session cookie,
// then back to Outbox (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest) {
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  const back = new URL(OUTBOX_PATH, requestOrigin(request));
  return NextResponse.redirect(await signInBackTo(request.nextUrl, back, exchange, 'ask'));
}
