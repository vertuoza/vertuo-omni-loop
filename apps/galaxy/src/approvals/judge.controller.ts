import { prdQueryOf } from '../approval/approval-api';
import { callerOrigin } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { STAGE_SIGNATURE_HEADER, verifySignature } from '../stages/event/event';
import { approvalInForce, type ApprovalRecord } from './judge.service';

// The judge route's HTTP edge (PRD 1612 s2, spec §3), as a plain function of a Request, so it is tested
// on a stubbed database and the route stays one line:
//
//   GET /api/approvals/judge?repo=<owner/name>&prd=<n>  → 200 {url, approval}
//
// The omni-loop App calls it to post the omni/approved check. It is signed as the App signs a stage
// event (src/stages/event/event.ts): `x-omni-signature-256: sha256=<hex>`, the HMAC-SHA256 under
// STAGE_EVENT_SECRET, which both apps share. A GET has no body, so the signed string is the request's
// path and query exactly as sent, `/api/approvals/judge?repo=…&prd=…` (judgeSigningString): a signature
// for one PRD never reads another. It carries no time: the answer is a read of what the PRD's page
// already shows its members, so a replayed request learns nothing newer than the record.
//
// `approval` is the approval in force in the kit's shape (kit/lib/approval/approval.ts), or null when
// nobody approved the PRD yet: {approver: {login, member}, approvedAt, files: [{kind, path, sha256,
// versionId, content?}], voids, voided}. `url` is the PRD page. Refusals follow ADR-0029, each `{error}`
// in plain words: 401 no secret here, or a missing or wrong signature (nothing is read); 400 a
// malformed query; 404 no dossier for that PRD; 503 no service role here; 500 the database failed or
// answered out of shape.

export type JudgeDeps = {
  /** STAGE_EVENT_SECRET; unset, every request is refused. */
  secret: string | undefined;
  /** The service role's reads of the approval record, or null when this deployment has none. */
  record: (() => ApprovalRecord) | null;
  log?: (line: string) => void;
};

const NOT_READ = 'The approval could not be read. Try again.';

/** What the App signs: the request's path and query, exactly as sent. */
export function judgeSigningString(request: Request): string {
  const url = new URL(request.url);
  return `${url.pathname}${url.search}`;
}

/** GET: the approval in force of the PRD the query names, for the App's omni/approved check. */
export async function answerJudge(request: Request, { secret, record, log = console.error }: JudgeDeps): Promise<Response> {
  if (!secret) {
    log('approval judge: STAGE_EVENT_SECRET is not set on this deployment, every request is refused');
    return refuse(401, 'Approval judgements are not accepted here.');
  }
  if (!verifySignature(secret, judgeSigningString(request), request.headers.get(STAGE_SIGNATURE_HEADER))) {
    return refuse(401, 'Bad signature.');
  }
  const named = prdQueryOf(request);
  if (named instanceof Response) return named;
  if (!record) return refuse(503, 'Approvals are not available here: this deployment has no service role.');

  const { repo, prd } = named;
  const read = await approvalInForce(record(), repo, prd);
  if (!read.ok) {
    log(`approval judge: ${repo} #${prd} could not be read: ${read.refusal.message ?? read.refusal.code ?? 'the database failed'}`);
    return refuse(500, NOT_READ);
  }
  if (!read.value) return refuse(404, `No dossier for PRD #${prd} of ${repo}.`);
  return reply(200, { url: `${callerOrigin(request)}/prd/${read.value.dossier}`, approval: read.value.approval });
}
