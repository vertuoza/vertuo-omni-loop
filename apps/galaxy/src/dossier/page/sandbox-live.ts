import 'server-only';
import { serverEnv } from '../../env';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { demoSandboxed } from './demo';
import { readSandboxed, type SandboxedKind } from './source';

// The before/after page's sandboxed route, read on the server as the signed-in person: their session
// cookie, so row-level security decides, and not found (null) to anyone signed out or outside the
// dossier's workspace, and for a version that is not a number of one. The demo serves its own page.
// A visual fix's round of variations is served the same way (PRD 627); the demo has none.

const VERSION = /^[1-9]\d{0,8}$/;

export async function readSandboxedLive(id: string, version: string, artifact: SandboxedKind = 'before-after'): Promise<string | null> {
  if (!VERSION.test(version)) return null;
  const number = Number(version);
  const mode = serverEnv().mode;
  if (mode === 'demo') return artifact === 'before-after' ? demoSandboxed(number) : null;
  if (mode === 'closed' || !supabaseEnv()) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  return readSandboxed(db, id, number, artifact);
}
