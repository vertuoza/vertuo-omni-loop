import { receiveTouch } from '../../../../src/touched/touched';
import { touchedDeps } from '../../../../src/touched/live';

// POST /api/github/touched, signed by omni-app → 200 marked | 202 nothing matched | 400 | 401 | 500: a
// webhook said something changed on GitHub; the dossiers it names are marked stale and refreshed after
// the response, under the snapshot's lease (src/touched/touched.ts, PRD 902 s3).
export async function POST(request: Request) {
  const { status, body } = await receiveTouch({ body: await request.text(), headers: request.headers }, touchedDeps());
  return Response.json(body, { status });
}
