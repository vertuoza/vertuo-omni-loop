import { registerPitch } from '../../../src/pitch/api';
import { pitchDeps } from '../../../src/pitch/api-live';

// POST /api/pitches {repo, prd, run, audience, look, commit, hook, benefit, kicker, closing} → {url, gif}:
// stores one pitch of a shipped PRD once its five files are uploaded, and answers the Pitch tab's link and
// the GIF's stable link (src/pitch/api.ts).
export function POST(request: Request) {
  return registerPitch(request, pitchDeps());
}
