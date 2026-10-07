import { requestPitchUploads } from '../../../../src/pitch/api';
import { pitchDeps } from '../../../../src/pitch/api-live';

// POST /api/pitches/uploads {repo, prd, files} → {run, files: [{name, path, url}]}: a new run's id and one
// signed upload link per file of the five, in the private pitches bucket (src/pitch/api.ts).
export function POST(request: Request) {
  return requestPitchUploads(request, pitchDeps());
}
