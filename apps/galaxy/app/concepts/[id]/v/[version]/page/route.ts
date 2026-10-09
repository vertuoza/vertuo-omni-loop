import type { NextRequest } from 'next/server';
import { sandboxedPage } from '../../../../../../src/dossier/page/sandbox';
import { readSandboxedLive } from '../../../../../../src/dossier/page/sandbox-live';

// /concepts/<id>/v/<version>/page (PRD 1272, s3), as /prd/<id>/v/<version>/page: version <version> of the
// concept's vision tour, sandboxed — its own policy puts it in an anonymous origin with no cookies and no
// network, even opened on its own — and not found to anyone who may not read the concept, and for a
// dossier of another kind, which holds no vision tour (src/dossier/page/sandbox.ts).

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  return sandboxedPage(await readSandboxedLive(id, version, 'vision'));
}
