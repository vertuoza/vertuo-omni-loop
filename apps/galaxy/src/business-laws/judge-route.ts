// The business laws' signed judge route (PRD 2632 s5), as a plain function of a Request, so it is tested with
// injected dependencies and app/api/business-laws/judge/route.ts stays one line:
//
//   POST /api/business-laws/judge {repo, spec}   → 200 {state, reason, laws, domains, findings}
//
// omni-app's inbox check calls it for a phase-0 pull request's spec (its sixth gate, `business laws`), signed as
// it signs the constituent judge (an HMAC-SHA256 over the exact body, `sha256=<hex>` in x-omni-signature-256),
// under its own shared secret BUSINESS_LAWS_JUDGE_SECRET: only galaxy holds the model key and reads the law
// home's pack. The judge is the one the PRD's page uses (./judge.service.ts): the same selection, the same
// batches, the same quote check, so a red carries the same words: law, Why, the spec's quote, who owns it.
//
// Merged laws only: the laws are read from the newest knowledge pack of the repository's product's law home,
// never from the pull request (N-PRODUCT-4). A repository with no law home, no pack or no law, no model key
// or a model error answers `neutral`, with why; the gate is never red on its own failure. Nothing is kept: a
// phase-0 pull request has no spec version to keep a verdict against.
//
// Refusals, each `{error}` in plain words: 401 no secret here, or a missing or wrong signature; 400 a malformed
// body; 413 a body past its cap; 500 the repository's laws could not be read. The gate reads any refusal as its
// own failure: neutral, never red.
import type { SelectionTerm } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { z } from 'zod';
import { refuse, reply } from '../business-api/reply';
import { parsed } from '../jev/decisions/decide-route';
import { STAGE_SIGNATURE_HEADER, verifySignature } from '../stages/event/event';
import { lawsOfPackFiles } from './law-home';
import { judgeSpec, type AskLaws, type LawVerdict } from './judge.service';
import { configOf } from './verdicts.service';

export const BUSINESS_LAWS_SIGNATURE_HEADER = STAGE_SIGNATURE_HEADER;
const BUSINESS_LAWS_JUDGE_SECRET_VAR = 'BUSINESS_LAWS_JUDGE_SECRET';

/** The body's cap: a spec of the gate's 40,000 characters, even all multi-byte, with room for the repository. */
export const MAX_BODY_BYTES = 192 * 1024;

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const Body = z.object({ repo: z.string().max(200).regex(REPO), spec: z.string().min(1) });

/** What the judge reads of a repository's product: its law home, the home's newest pack, its glossary and domains. */
export type RepoLaws = {
  home: string | null;
  pack: { sha: string; files: { path: string; content: string }[] } | null;
  glossary: SelectionTerm[];
  domains: { key: string; name: string }[];
};

export type BusinessLawsRouteDeps = {
  /** The judge's own secret (BUSINESS_LAWS_JUDGE_SECRET); unset, every call is refused. */
  secret: string | undefined;
  /** What the product of `repo` holds for the judge; throws when it cannot be read. */
  read: (repo: string) => Promise<RepoLaws>;
  /** The model, or null without a key: every spec is then not judged. */
  ask: AskLaws | null;
  log?: (line: string) => void;
};

const neutral = (reason: string): LawVerdict => ({ state: 'neutral', reason, laws: [], domains: [], findings: [] });

/** The verdict on `spec` against the laws `laws` holds. */
async function judged(spec: string, laws: RepoLaws, ask: AskLaws | null): Promise<LawVerdict> {
  if (laws.home === null) return neutral('the repository has no law home');
  if (laws.pack === null) return neutral('the law home has no knowledge pack yet');
  const { root, owners } = configOf(laws.pack.files);
  const business = lawsOfPackFiles(laws.pack.files, root);
  if (business.length === 0) return neutral('the law home holds no business law');
  const verdict = await judgeSpec({ spec, laws: business, glossary: laws.glossary, owners, ask });
  const names = new Map(laws.domains.map((domain) => [domain.key, domain.name]));
  return { ...verdict, domains: verdict.domains.map((domain) => (names.has(domain.key) ? { ...domain, name: names.get(domain.key) } : domain)) };
}

/** The route, as a plain function of a Request and its dependencies. */
export async function businessLawsJudgeRoute(request: Request, deps: BusinessLawsRouteDeps): Promise<Response> {
  const note = deps.log ?? console.error;
  if (!deps.secret) {
    note(`business laws judge: ${BUSINESS_LAWS_JUDGE_SECRET_VAR} is not set on this deployment, every call is refused`);
    return refuse(401, 'The business laws judge is not open here.');
  }
  const text = await request.text();
  if (!verifySignature(deps.secret, text, request.headers.get(BUSINESS_LAWS_SIGNATURE_HEADER))) return refuse(401, 'Bad signature.');
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `A judge call carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  const body = Body.safeParse(parsed(text));
  if (!body.success) return refuse(400, 'The body must be a JSON object with a repository (owner/name) and a spec.');
  const repo = body.data.repo.toLowerCase();
  let laws: RepoLaws;
  try {
    laws = await deps.read(repo);
  } catch (error) {
    note(`business laws judge: the laws of ${repo} could not be read — ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    return refuse(500, 'The laws of this repository could not be read. Try again.');
  }
  return reply(200, await judged(body.data.spec, laws, deps.ask));
}
