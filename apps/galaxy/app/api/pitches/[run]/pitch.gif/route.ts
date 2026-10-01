import { pitchGif } from '../../../../../src/pitch/api';
import { pitchDeps } from '../../../../../src/pitch/api-live';

// GET /api/pitches/:run/pitch.gif → 302 to a fresh 5-minute signed link to the pitch's GIF, without
// sign-in (it is pasted where nobody signs in); 404 for no such run (src/pitch/api.ts).
export async function GET(request: Request, { params }: { params: Promise<{ run: string }> }) {
  return pitchGif(request, (await params).run, pitchDeps());
}
