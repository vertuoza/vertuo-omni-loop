import { runnersDeps } from '../../../../../../src/runners/runners.live';
import { refreshGithubToken } from '../../../../../../src/runners/runners.controller';

// POST /api/runners/jobs/<id>/github-token → 200 {token, expiresAt}: a fresh token of the GitHub App the job
// runs as (PRD 2433), with the kit's sign-in, only for the runner that holds the job, while it is claimed or
// running and for 10 minutes after it ends; 403 to another runner's owner, 409 after that or for a job that
// runs as no App (src/runners/runners.controller.ts).
export const maxDuration = 30;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return refreshGithubToken(request, (await params).id, runnersDeps());
}
