import { registerRun } from '../../../src/proof/api';
import { proofDeps } from '../../../src/proof/api-live';

// POST /api/proofs {repo, prd, run, commit, url, criteria} → {url}: stores one proof run of a PRD once its
// files are uploaded, and answers the Proof tab's link (src/proof/api.ts).
export function POST(request: Request) {
  return registerRun(request, proofDeps());
}
