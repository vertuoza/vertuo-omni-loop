import { refuse } from '../../../../../../src/business-api/reply';
import { fixWithAnswers } from '../../../../../../src/runners/page/fix';
import { fixDeps } from '../../../../../../src/runners/page/fix.live';

// POST /api/runners/jobs/<id>/fix → 200 {job}: Fix with answers queues `/omni:yolo-fix <n>` as the
// continuation of a job that waited on answers, with the page's session (src/runners/page/fix.ts, PRD 2270 s2).
export const maxDuration = 30;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const deps = fixDeps();
  return deps === null ? refuse(503, 'Runners are not available here: this deployment has no database or service role.') : fixWithAnswers((await params).id, deps);
}
