import { signedJudgeRoute } from './judge-route';
import { lawWorth, lawWorthInput, lawWorthOld } from './law-worth';

// The App's law judge (PRD 1342 s3), as a plain function of a Request, so it is tested with injected
// dependencies and app/api/laws/judge/route.ts stays one line:
//
//   POST /api/laws/judge {repo, state, old, ref?}   → 200 {answer, confidence, decidedBy}
//
// omni-app's knowledge harvest calls it for each rule or invariant with no test proving it, signed as
// the constituent judge is (./judge-route.ts: an HMAC-SHA256 over the exact body in x-omni-signature-256),
// under its own shared secret LAW_JUDGE_SECRET. `state` is ./law-worth.ts's (the statement, its Why, the
// principle it serves, its domain, its PRD's title) and `old` the classifier's own `worthALaw`, `"true"`
// or `"false"`. The workspace, the mode, the floor and the refusals are the constituent judge's: the
// reply always carries the answer that counts, and the harvest reads any refusal as the classifier's.

export const LAW_JUDGE_SECRET_VAR = 'LAW_JUDGE_SECRET';

/** The body's cap: a law-worth state at its caps, with room for the repository and the ref. */
const MAX_BODY_BYTES = 64 * 1024;

export const lawJudgeRoute = signedJudgeRoute({
  entry: lawWorth,
  reader: { input: lawWorthInput, old: lawWorthOld },
  secretVar: LAW_JUDGE_SECRET_VAR,
  label: 'law judge',
  maxBodyBytes: MAX_BODY_BYTES,
});
