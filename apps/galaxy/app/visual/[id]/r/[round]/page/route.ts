import type { NextRequest } from 'next/server';
import { sandboxedPage } from '../../../../../../src/dossier/page/sandbox';
import { readSandboxedLive } from '../../../../../../src/dossier/page/sandbox-live';

// /visual/<id>/r/<round>/page (PRD 627): round <round> of a visual fix's variations, sandboxed as its
// before/after page is — its own policy puts it in an anonymous origin with no cookies and no network,
// even opened on its own — and not found to anyone who may not read the dossier (src/dossier/page/sandbox.ts).

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; round: string }> }) {
  const { id, round } = await params;
  return sandboxedPage(await readSandboxedLive(id, round, 'variations'));
}
