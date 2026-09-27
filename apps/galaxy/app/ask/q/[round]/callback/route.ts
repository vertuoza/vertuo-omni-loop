import { NextResponse, type NextRequest } from 'next/server';
import { questionSignInReturn, requestOrigin } from '../../../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../../../src/data/supabase-server';

// Where Google sends the person back after signing in on a shared question: the code becomes the
// session cookie, then back to the same question (src/ask/page/sign-in.ts).

export async function GET(request: NextRequest, { params }: { params: Promise<{ round: string }> }) {
  const { round } = await params;
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return NextResponse.redirect(await questionSignInReturn(request.nextUrl, requestOrigin(request), round, exchange));
}
