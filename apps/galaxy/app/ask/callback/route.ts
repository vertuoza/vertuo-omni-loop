import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin, signInReturn } from '../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';

// Where Google sends the person back after signing in on their page, /ask: the code becomes the
// session cookie, then back to /ask (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest) {
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return NextResponse.redirect(await signInReturn(request.nextUrl, requestOrigin(request), null, exchange));
}
