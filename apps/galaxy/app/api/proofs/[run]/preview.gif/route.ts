import { previewGif } from '../../../../../src/proof/api';
import { proofDeps } from '../../../../../src/proof/api-live';

// GET /api/proofs/:run/preview.gif → 302 to a fresh 5-minute signed link to the run's GIF, without
// sign-in (GitHub's image proxy cannot sign in); 404 for a run without one (src/proof/api.ts).
export async function GET(request: Request, { params }: { params: Promise<{ run: string }> }) {
  return previewGif(request, (await params).run, proofDeps());
}
