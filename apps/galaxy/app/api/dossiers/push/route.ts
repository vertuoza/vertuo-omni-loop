import { after } from 'next/server';
import { judgingAfter } from '../../../../src/business-laws/after-push';
import { judgeAfterPush } from '../../../../src/business-laws/verdicts.live';
import { pushDossier } from '../../../../src/dossier/api';
import { dossierDeps } from '../../../../src/dossier/api-live';

// POST /api/dossiers/push {repo, prd, title, draftId?, artifacts} → {id, url, added, unchanged}: a PRD
// folder's artifacts, a version added where one changed (src/dossier/api.ts). Once it has answered, the
// dossier's latest spec is judged against its business laws (PRD 2632), after the response: a slow model
// never slows a push.
export const maxDuration = 60;

export async function POST(request: Request) {
  return judgingAfter(await pushDossier(request, dossierDeps()), (task) => { after(task); }, judgeAfterPush);
}
