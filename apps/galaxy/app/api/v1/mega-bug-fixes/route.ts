import { startMegaBugFix } from '../../../../src/public-api/public-api.controller';
import { publicApiDeps } from '../../../../src/public-api/public-api.live';

// POST /api/v1/mega-bug-fixes {repo, description, runner?, fleet?} → 202 job: queues /omni:mega-bug-fix in a
// plan repository of the workspace, for a bug whose cause may sit in another of its targets
// (src/public-api/public-api.controller.ts). It never answers 404: a 404 is a deployment older than it.
export const maxDuration = 30;

export function POST(request: Request) {
  return startMegaBugFix(request, publicApiDeps());
}
