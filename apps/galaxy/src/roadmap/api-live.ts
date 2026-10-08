import 'server-only';
import { after } from 'next/server';
import { supabaseAs, supabaseEnv } from '../data/supabase-server';
import { serviceDb } from '../data/sign-in-live';
import { jevDecideDeps } from '../jev/resolve-live';
import { installUrl } from '../signup/github-app';
import type { RoadmapDeps } from './api';
import { classifyHumanWork, humanWorkClassifier } from './classify-jev';
import { serverEnv } from '../env';

// The roadmaps' real dependencies: a Supabase client per call, acting as the caller's access token
// (never a service key), so roadmap_push() checks who calls and row-level security has the last word.
// Without Supabase configured (the demo galaxy, a closed build) every push answers 503. A refusal for a
// repository no workspace owns ends with the App's install link (GITHUB_APP_SLUG), when this deployment
// has one.
//
// Jev's Human work kind (PRD 1217 s3) runs after the answer (Next's after()), as the service role, as
// every Jev decision (./classify-jev.ts). Without SUPABASE_SERVICE_ROLE_KEY no Jev decision runs, and
// every key keeps its rule kind.
export function roadmapDeps(): RoadmapDeps {
  if (!supabaseEnv()) return { connect: null };
  const jev = jevDecideDeps();
  return {
    connect: supabaseAs,
    installLink: installUrl(serverEnv().githubAppSlug),
    ...(jev ? {
      classify: (roadmapId: string) => { after(() => classifyHumanWork(humanWorkClassifier(serviceDb(), jev), roadmapId)); },
    } : {}),
  };
}
