import { refuse, reply } from '../../business-api/reply';
import { STAGE_SIGNATURE_HEADER, verifySignature } from '../../stages/event/event';
import { decide, type JevDecideDeps } from '../resolve';
import { constituentBreak, constituentBreakInput, constituentBreakOld } from './constituent-break';
import { askedFrom, parsed, type StateReader } from './decide-route';
import type { JevDecisionEntry } from './entry';

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
// The law judge (PRD 1342 s3, ./law-judge-route.ts) is the same route for `law-worth`, under its own
// secret: signedJudgeRoute makes each one.
//
// Refusals, each `{error}` in plain words: 401 no secret here, or a missing or wrong signature; 400 a
// malformed body; 413 a body past its cap; 500 the workspace could not be looked up. The gate reads any
// refusal as its own failure: neutral, never red.

export const JUDGE_SIGNATURE_HEADER = STAGE_SIGNATURE_HEADER;
const JUDGE_SECRET_VAR = 'CONSTITUENT_JUDGE_SECRET';

export type JudgeRouteDeps = {
  /** The judge's own secret (CONSTITUENT_JUDGE_SECRET, LAW_JUDGE_SECRET); unset, every call is refused. */
  secret: string | undefined;
  /** The workspace that tracks `repo`, or null when none does. */
  workspaceOf: (repo: string) => Promise<string | null>;
  /** The resolver's dependencies, or null without the service role: today's answer counts. */
  jev: JevDecideDeps | null;
  log?: (line: string) => void;
};

/** One signed judge: the yes-or-no decision it asks, how it reads a body, its secret and its body's cap. */
export type SignedJudge<I> = {
  entry: JevDecisionEntry<I, boolean>;
  reader: StateReader<I, boolean>;
  /** The secret's variable, named when it is not set. */
  secretVar: string;
  /** The judge, as its logs and refusals name it: `constituent judge`. */
  label: string;
  maxBodyBytes: number;
};

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

/** The signed body as the judge reads it, its repository lowercased, or the refusal that says why not. */
function readSigned<I>(judge: SignedJudge<I>, secret: string, text: string, signature: string | null) {
  if (!verifySignature(secret, text, signature)) return refuse(401, 'Bad signature.');
  if (new TextEncoder().encode(text).length > judge.maxBodyBytes) return refuse(413, `A judge call carries ${judge.maxBodyBytes / 1024} KiB at most.`);
  const body = parsed(text);
  if (!body) return refuse(400, 'The body must be a JSON object.');
  const asked = askedFrom(body, judge.entry.name, judge.reader);
  return asked instanceof Response ? asked : { ...asked, repo: asked.repo.toLowerCase() };
}

/** The workspace tracking `repo`, null when none does, or the 500 when it could not be looked up. */
async function lookUp(label: string, repo: string, { workspaceOf, log = console.error }: JudgeRouteDeps): Promise<string | null | Response> {
  try {
    return await workspaceOf(repo);
  } catch (error) {
    log(`${label}: the workspace of ${repo} could not be looked up — ${why(error)}`);
    return refuse(500, 'The workspace of this repository could not be looked up. Try again.');
  }
}

/** The route of one signed judge, as a plain function of a Request and its dependencies. */
export function signedJudgeRoute<I>(judge: SignedJudge<I>) {
  const { entry, secretVar, label } = judge;
  const today = (old: boolean) => reply(200, { answer: entry.show(old), confidence: null, decidedBy: 'old' });
  return async (request: Request, deps: JudgeRouteDeps): Promise<Response> => {
    if (!deps.secret) {
      (deps.log ?? console.error)(`${label}: ${secretVar} is not set on this deployment, every call is refused`);
      return refuse(401, `The ${label} is not open here.`);
    }
    const judged = readSigned(judge, deps.secret, await request.text(), request.headers.get(JUDGE_SIGNATURE_HEADER));
    if (judged instanceof Response) return judged;
    if (!deps.jev) return today(judged.old);
    const workspace = await lookUp(label, judged.repo, deps);
    if (workspace instanceof Response) return workspace;
    if (!workspace) return today(judged.old);

    const counted = await decide(deps.jev, { workspace, entry, input: judged.input, old: () => Promise.resolve(judged.old), ref: judged.ref });
    if (counted.decidedBy !== 'jev' || counted.value === null) return today(judged.old);
    return reply(200, { answer: entry.show(counted.value), confidence: counted.confidence, decidedBy: 'jev' });
  };
}

/** The constituent judge: a spec of CONSTITUENT_SPEC_LIMIT characters, its constituents and the findings fit its cap. */
export const judgeRoute = signedJudgeRoute({
  entry: constituentBreak,
  reader: { input: constituentBreakInput, old: constituentBreakOld },
  secretVar: JUDGE_SECRET_VAR,
  label: 'constituent judge',
  maxBodyBytes: 128 * 1024,
});
