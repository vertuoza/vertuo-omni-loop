import { NextResponse, type NextRequest } from 'next/server';
import { historySignInReturn, requestOrigin } from '../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';

// Where Google sends the person back after signing in on the history: the code becomes the session
// cookie, then back to the history (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest) {
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return NextResponse.redirect(await historySignInReturn(request.nextUrl, requestOrigin(request), exchange));
}
