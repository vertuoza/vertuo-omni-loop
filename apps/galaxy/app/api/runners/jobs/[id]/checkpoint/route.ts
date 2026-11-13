import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { checkpointJob } from '../../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id>/checkpoint → a job's save (PRD 2809, s4), with the kit's sign-in, only for the owner of the
// runner that holds the job, whatever its status: {step: "link", bytes} → 200 {path, url, expiresAt}, a signed upload
// link to the private bucket runner-checkpoints (400 over 100 MB); {step: "record", kind, path?, manifest} → 200
// {id, kind, keepUntil}, the save recorded (400 a manifest out of shape or a bundle not uploaded, 409 a local save after
// the portable one). 403 to another runner's owner (src/runners/runners.controller.ts).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return checkpointJob(request, (await params).id, runnersDeps());
}
