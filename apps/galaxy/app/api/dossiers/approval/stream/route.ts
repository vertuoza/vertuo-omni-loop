import { streamDeps } from '../../../../../src/approvals/stream-live';
import { streamApproval } from '../../../../../src/approvals/stream.controller';

// GET /api/dossiers/approval/stream?repo=<owner/name>&prd=<n> → 200 text/event-stream: `omni wait
// approval` follows a ◆ PRD's approval (asked, re-asked, approved, voided, ping), resuming after
// Last-Event-ID; the stream says `reconnect` and closes before this function's limit
// (src/approvals/stream.controller.ts, PRD 1322 s3).
export const maxDuration = 300;

export function GET(request: Request) {
  return streamApproval(request, streamDeps(maxDuration));
}
