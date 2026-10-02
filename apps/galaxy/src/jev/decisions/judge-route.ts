import { refuse, reply } from '../../business-api/reply';
import { STAGE_SIGNATURE_HEADER, verifySignature } from '../../stages/event/event';
import { decide, type JevDecideDeps } from '../resolve';
import { constituentBreak, constituentBreakInput, constituentBreakOld } from './constituent-break';
import { askedFrom, parsed } from './decide-route';

// The App's constituent judge (PRD 871 s4), as a plain function of a Request, so it is tested with
// injected dependencies and app/api/constituents/judge/route.ts stays one line:
//
//   POST /api/constituents/judge {repo, state, old, ref?}   → 200 {answer, confidence, decidedBy}
//
// omni-app's canon gate calls it, signed as it signs stage events (an HMAC-SHA256 over the exact body,
// `sha256=<hex>` in x-omni-signature-256), under its own shared secret CONSTITUENT_JUDGE_SECRET, since
// only Galaxy holds a workspace's sealed Jev key. `state` is ./constituent-break.ts's (the spec, the
// product's constituents, today's verdict) and `old` today's answer, `"true"` broken or `"false"`. The
// workspace is the one constituents_for_repo_app() reads the constituents from: of the workspaces
// tracking `repo`, the one whose GitHub org owns it, then the earliest to add it, then by slug.
//
// The resolver runs the workspace's mode: Off answers today's without calling Jev, Shadow answers
// today's and logs Jev's beside it, On answers Jev's when it answered at or above the floor. Unlike
// /api/decide, the reply always carries the answer that counts (today's when it is today's), so the
// gate reads one field. No workspace tracking `repo`, or no service role here: today's answer.
//
// Refusals, each `{error}` in plain words: 401 no secret here, or a missing or wrong signature; 400 a
// malformed body; 413 a body past its cap; 500 the workspace could not be looked up. The gate reads any
// refusal as its own failure: neutral, never red.

export const JUDGE_SIGNATURE_HEADER = STAGE_SIGNATURE_HEADER;
export const JUDGE_SECRET_VAR = 'CONSTITUENT_JUDGE_SECRET';

export type JudgeRouteDeps = {
  /** CONSTITUENT_JUDGE_SECRET; unset, every call is refused. */
  secret: string | undefined;
  /** The workspace whose constituents `repo` reads, or null when none tracks it. */
  workspaceOf: (repo: string) => Promise<string | null>;
  /** The resolver's dependencies, or null without the service role: today's answer counts. */
  jev: JevDecideDeps | null;
  log?: (line: string) => void;
};

/** The body's cap: a spec of CONSTITUENT_SPEC_LIMIT characters, its constituents and the findings. */
const MAX_BODY_BYTES = 128 * 1024;

/** A workspace tracking the repository, read with its org and slug. */
export type TrackingRow = { workspace_id: string; added_at: string; workspaces: { github_org: string | null; slug: string } | null };

/** The workspace constituents_for_repo_app() reads `repo` from: owner's org first, then earliest, then slug. */
export function placedWorkspace(repo: string, rows: TrackingRow[]): string | null {
  const owner = repo.split('/')[0]?.toLowerCase() ?? '';
  const owns = (row: TrackingRow) => (row.workspaces?.github_org?.toLowerCase() === owner ? 0 : 1);
  const sorted = [...rows].sort(
    (a, b) => owns(a) - owns(b) || Date.parse(a.added_at) - Date.parse(b.added_at) || (a.workspaces?.slug ?? '').localeCompare(b.workspaces?.slug ?? ''),
  );
  return sorted[0]?.workspace_id ?? null;
}

const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));
const today = (old: boolean) => reply(200, { answer: constituentBreak.show(old), confidence: null, decidedBy: 'old' });

export async function judgeRoute(request: Request, { secret, workspaceOf, jev, log = console.error }: JudgeRouteDeps): Promise<Response> {
  if (!secret) {
    log(`constituent judge: ${JUDGE_SECRET_VAR} is not set on this deployment, every call is refused`);
    return refuse(401, 'The constituent judge is not open here.');
  }
  const text = await request.text();
  if (!verifySignature(secret, text, request.headers.get(JUDGE_SIGNATURE_HEADER))) return refuse(401, 'Bad signature.');
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `A judge call carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  const body = parsed(text);
  if (!body) return refuse(400, 'The body must be a JSON object.');
  const asked = askedFrom(body, constituentBreak.name, { input: constituentBreakInput, old: constituentBreakOld });
  if (asked instanceof Response) return asked;
  const judged = { ...asked, repo: asked.repo.toLowerCase() };

  if (!jev) return today(judged.old);
  let workspace: string | null;
  try {
    workspace = await workspaceOf(judged.repo);
  } catch (error) {
    log(`constituent judge: the workspace of ${judged.repo} could not be looked up — ${why(error)}`);
    return refuse(500, 'The workspace of this repository could not be looked up. Try again.');
  }
  if (!workspace) return today(judged.old);

  const counted = await decide(jev, { workspace, entry: constituentBreak, input: judged.input, old: () => Promise.resolve(judged.old), ref: judged.ref });
  if (counted.decidedBy !== 'jev' || counted.value === null) return today(judged.old);
  return reply(200, { answer: constituentBreak.show(counted.value), confidence: counted.confidence, decidedBy: 'jev' });
}
