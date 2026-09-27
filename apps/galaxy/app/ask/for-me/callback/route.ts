import { NextResponse, type NextRequest } from 'next/server';
import { forMeSignInReturn, requestOrigin } from '../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';

// Where Google sends the person back after signing in on For me: the code becomes the session cookie,
// then back to For me (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest) {
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return NextResponse.redirect(await forMeSignInReturn(request.nextUrl, requestOrigin(request), exchange));
}
