import type { NextRequest } from 'next/server';
import { sandboxedPage } from '../../../../../../src/dossier/page/sandbox';
import { readSandboxedLive } from '../../../../../../src/dossier/page/sandbox-live';

// /concepts/<id>/r/<round>/page (PRD 1272, s3), as /visual/<id>/r/<round>/page: round <round> of the
// concept's boards, sandboxed as its vision tour is, and not found to anyone who may not read the concept,
// and for a dossier of another kind, which holds no board (src/dossier/page/sandbox.ts).

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; round: string }> }) {
  const { id, round } = await params;
  return sandboxedPage(await readSandboxedLive(id, round, 'board'));
}
