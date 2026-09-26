import { NextResponse, type NextRequest } from 'next/server';
import { requestOrigin } from '../../../src/ask/page/sign-in';
import { supabaseEnv, supabaseServer } from '../../../src/data/supabase-server';
import { knowledgeSignInReturn } from '../../../src/knowledge/sign-in';

// Where Google sends the person back after signing in on the knowledge map: the code becomes the
// session cookie, then back to /knowledge on the entry the address named (src/knowledge/sign-in.ts).

export async function GET(request: NextRequest) {
  const exchange = supabaseEnv() ? async (code: string) => (await supabaseServer()).auth.exchangeCodeForSession(code) : null;
  return NextResponse.redirect(await knowledgeSignInReturn(request.nextUrl, requestOrigin(request), exchange));
}
