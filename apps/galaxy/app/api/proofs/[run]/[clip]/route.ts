import { proofClip } from '../../../../../src/proof/api';
import { proofDeps } from '../../../../../src/proof/api-live';

// GET /api/proofs/:run/before.webm and /after.webm → 302 to a fresh 5-minute signed link to that clip of the
// run, without sign-in, like the run's GIF; 404 for any other name and for a run without that clip
// (src/proof/api.ts).
export async function GET(request: Request, { params }: { params: Promise<{ run: string; clip: string }> }) {
  const { run, clip } = await params;
  return proofClip(request, run, clip, proofDeps());
}
