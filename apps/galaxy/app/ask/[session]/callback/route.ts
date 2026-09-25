import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin, signInReturn } from '../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../src/data/supabase-server';

// Where Google sends the person back after signing in on an ask page: the code becomes the session
// cookie, then back to the same session (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest, { params }: { params: Promise<{ session: string }> }) {
  const { session } = await params;
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return NextResponse.redirect(await signInReturn(request.nextUrl, requestOrigin(request), session, exchange));
}
