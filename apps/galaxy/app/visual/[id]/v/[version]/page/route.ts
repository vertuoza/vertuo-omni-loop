import type { NextRequest } from 'next/server';
import { sandboxedPage } from '../../../../../../src/dossier/page/sandbox';
import { readSandboxedLive } from '../../../../../../src/dossier/page/sandbox-live';

// /visual/<id>/v/<version>/page (PRD 627), as /prd/<id>/v/<version>/page: version <version> of the dossier's before/after page, sandboxed — its
// own policy puts it in an anonymous origin with no cookies and no network, even opened on its own —
// and not found to anyone who may not read the dossier (src/dossier/page/sandbox.ts).

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  return sandboxedPage(await readSandboxedLive(id, version));
}
