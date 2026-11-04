import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv, type ArcadeEnv } from '../env';
import type { BusinessLawsRouteDeps } from './judge-route';
import { lawsModelFromEnv } from './model';
import { readRepoLaws } from './repo-laws.repository';

// The business laws judge route's real dependencies (./judge-route.ts, PRD 2632 s5): BUSINESS_LAWS_JUDGE_SECRET
// (server only, shared with omni-app), the service role reading the product of the repository and the newest
// pack of its law home (./repo-laws.repository.ts), and OpenRouter judging (OPENROUTER_API_KEY; without it every
// spec is not judged, and says why). Each is read per call.
export function businessLawsJudgeDeps(env: Pick<ArcadeEnv, 'businessLawsJudgeSecret' | 'openrouter'> = serverEnv()): BusinessLawsRouteDeps {
  return { secret: env.businessLawsJudgeSecret ?? undefined, read: (repo) => readRepoLaws(serviceDb(), repo), ask: lawsModelFromEnv(env.openrouter) };
}
