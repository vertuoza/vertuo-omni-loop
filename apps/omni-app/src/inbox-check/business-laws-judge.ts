// The inbox check's business laws judge port (PRD 2632 s5): the one call to galaxy's
// `POST /api/business-laws/judge`, which judges a phase-0 pull request's spec against the business laws of the
// repository's product, since only galaxy holds the model key and the law home's pack.
//
//   request  {repo, spec}     signed as the constituent judge is (../canon/judge.ts): an HMAC-SHA256 over the
//                             exact body, `sha256=<hex>` in x-omni-signature-256, under
//                             BUSINESS_LAWS_JUDGE_SECRET (shared by both apps)
//   reply    {state, reason, laws, domains, findings}   `state` is green, red or neutral; each finding carries
//                             the law, its statement and Why as they are in the pack, the spec's quote and the
//                             law's owners
//
// The gate says it with the PRD page's words: for each finding the law and its statement, why it exists, the
// spec's words and who owns it. Never throws, never red on its own failure: no secret, a refusal, a reply out
// of shape or a network failure comes back as a neutral gate saying why. GitHub stops the merge only where the
// repository requires the check.
import { z } from 'zod';
import { STAGE_SIGNATURE_HEADER, signStageEvent, stageEventUrl } from '../stage-forward/stage-forward.ts';
import type { Gate, LawsGrader } from './evaluate-inbox.ts';

const SECRET_VAR = 'BUSINESS_LAWS_JUDGE_SECRET';
/** The gate's name, as the check shows it. */
const GATE = 'business laws';
/** Galaxy's route allows itself a minute. */
const TIMEOUT_MS = 55_000;

const FindingSchema = z.looseObject({
  law: z.string(),
  statement: z.string(),
  why: z.string(),
  quote: z.string(),
  owners: z.array(z.string()).catch([]),
});

const VerdictSchema = z.looseObject({
  state: z.enum(['green', 'red', 'neutral']),
  reason: z.string(),
  laws: z.array(z.string()),
  domains: z.array(z.looseObject({ key: z.string(), name: z.string().optional() })).catch([]),
  findings: z.array(FindingSchema).catch([]),
});

/** A refusal's reply, read for its `error` line. */
const RefusalSchema = z.looseObject({ error: z.string().optional().catch(undefined) });

/** Galaxy's business laws judge route, on galaxy's host (`GALAXY_URL` or its default), as the stage events. */
export function businessLawsJudgeUrl(galaxyUrl: string): string {
  return `${new URL(stageEventUrl(galaxyUrl)).origin}/api/business-laws/judge`;
}

const notJudged = (why: string): Gate => ({ name: GATE, ok: true, neutral: true, reason: `not judged: ${why}` });

/** One finding in the page's words: the law, why it exists, the spec's words, who owns it. */
function detailsOf(finding: z.infer<typeof FindingSchema>): string[] {
  const owners = finding.owners.length > 0 ? finding.owners.map((owner) => `@${owner}`).join(' or ') : 'nobody is named';
  return [
    `${finding.law}: ${finding.statement}`,
    `Why: ${finding.why === '' ? 'not given' : finding.why}`,
    `The spec says: "${finding.quote}"`,
    `Owner: ${owners}`,
  ];
}

/** The gate a verdict makes: red with each finding's words, green with what it judged, or neutral. */
function gateOf(verdict: z.infer<typeof VerdictSchema>): Gate {
  if (verdict.state === 'neutral') return notJudged(verdict.reason);
  if (verdict.state === 'green') {
    const domains = verdict.domains.map((domain) => domain.name ?? domain.key);
    const where = domains.length > 0 ? ` · ${domains.join(', ')}` : '';
    return { name: GATE, ok: true, reason: verdict.laws.length === 0 ? verdict.reason : `${verdict.laws.length} judged${where}` };
  }
  const reason = `${verdict.reason}: ${verdict.findings.map((finding) => finding.law).join(', ')}`;
  return { name: GATE, ok: false, title: `${GATE} ✗ ${verdict.findings.length}`, reason, details: verdict.findings.flatMap(detailsOf) };
}

/** What galaxy answered to one signed call: its JSON reply, or why there is none to read. */
type Called = { reply: unknown } | { why: string };

/** One signed POST of `body` to galaxy. */
async function signedCall(post: (url: string, init: RequestInit) => Promise<Response>, { url, secret, body, timeoutMs }: { url: string; secret: string; body: string; timeoutMs: number }): Promise<Called> {
  const headers = { 'content-type': 'application/json', [STAGE_SIGNATURE_HEADER]: signStageEvent(secret, body) };
  try {
    const response = await post(url, { method: 'POST', body, headers, signal: AbortSignal.timeout(timeoutMs) });
    const reply: unknown = await response.json().catch(() => null);
    return response.ok ? { reply } : { why: `galaxy answered ${response.status}${refusalOf(reply)}` };
  } catch (error) {
    return { why: `galaxy could not be reached: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** A refusal's `: <error>` tail, or nothing. */
function refusalOf(reply: unknown): string {
  const refusal = RefusalSchema.safeParse(reply);
  return refusal.success && refusal.data.error ? `: ${refusal.data.error}` : '';
}

/** The gate a reply makes; neutral when it is no verdict, or a red with nothing to show. */
function gateOfReply(reply: unknown): Gate {
  const verdict = VerdictSchema.safeParse(reply);
  if (!verdict.success) return notJudged('galaxy answered no verdict');
  if (verdict.data.state === 'red' && verdict.data.findings.length === 0) return notJudged('galaxy answered a red with no finding');
  return gateOf(verdict.data);
}

/** The grader bound to galaxy's route and the shared secret. */
export function businessLawsJudge({ url, secret, fetch: post = fetch, timeoutMs = TIMEOUT_MS }: {
  url: string;
  secret: string | undefined;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}): LawsGrader {
  return {
    async grade({ repo, spec }) {
      if (!secret) return notJudged(`judge not configured (${SECRET_VAR} is not set)`);
      const called = await signedCall(post, { url, secret, body: JSON.stringify({ repo, spec }), timeoutMs });
      return 'why' in called ? notJudged(called.why) : gateOfReply(called.reply);
    },
  };
}
