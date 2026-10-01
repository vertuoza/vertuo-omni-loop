import { requestUploads } from '../../../../src/proof/api';
import { proofDeps } from '../../../../src/proof/api-live';

// POST /api/proofs/uploads {repo, prd, files} → {run, files: [{name, path, url}]}: a new run's id and one
// signed upload link per file, in the private proof-videos bucket (src/proof/api.ts).
export function POST(request: Request) {
  return requestUploads(request, proofDeps());
}
