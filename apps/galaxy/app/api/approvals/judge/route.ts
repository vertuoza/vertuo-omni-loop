import { answerJudge } from '../../../../src/approvals/judge.controller';
import { judgeDeps } from '../../../../src/approvals/judge-live';

// GET /api/approvals/judge?repo=<owner/name>&prd=<n> → 200 {url, approval} | 400 | 401 | 404 | 500 | 503:
// the approval in force of a PRD born on the server, for the omni-loop App's omni/approved check (PRD
// 1612). Signed by the App as a stage event is, with STAGE_EVENT_SECRET, but over the request's path and
// query exactly as sent (`/api/approvals/judge?repo=…&prd=…`), since a GET has no body:
// `x-omni-signature-256: sha256=<hmac-sha256 hex>`. Unsigned or wrongly signed: 401
// (src/approvals/judge.controller.ts).
export const maxDuration = 30;

export function GET(request: Request) {
  return answerJudge(request, judgeDeps());
}
