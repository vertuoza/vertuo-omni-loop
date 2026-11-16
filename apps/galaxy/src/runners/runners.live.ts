import 'server-only';
import { after } from 'next/server';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import { productsRepository, type ProductsRepository } from '../products/products.repository';
import { wakeMission } from '../missions/missions.live';
import { liveNotifier } from '../public-api/notify.live';
import type { RunnersDeps } from './runners.controller';
import { githubDeps } from './runners.github';
import { readyWake } from './ready-wake';
import { readyWakeStore } from './ready-wake.repository';
import { checkpointsRepository, runnersRepository } from './runners.repository';
import { checkpointsService, productReposOf, runnersService, type AppJobEnded, type CheckpointsService, type GithubDeps, type ProductRepos, type RunnersService } from './runners.service';

// The runners' real dependencies (PRD 1830 s1), for /api/runners/*: the kit's sign-in checked with the
// Auth server (a client acting as the caller's access token), the browser's from the page's session
// cookies, and the rules over the service role's client (SUPABASE_SERVICE_ROLE_KEY, server only), the
// one role that writes the two tables. Without Supabase configured (the demo galaxy) every call answers
// 503; without the service role key, too, said in its words. A job sent by a key with a link (PRD 2425 s8) pings it from
// here too: the runners' routes are where a job is claimed and reported, so they are where its status changes.
//
// A job runs as the Omni GitHub App (PRD 2573), the App this deployment signs in with (GITHUB_APP_ID,
// GITHUB_APP_PRIVATE_KEY), or, when its key holds an App, as that App (PRD 2915), its private key opened under
// SECRETS_MASTER_KEY: its token is minted through the global fetch (./runners.github.ts), by one wiring kept
// for the server's process, so the Omni App's bot is read from GitHub once. A skill that spans the product (a mega bug fix,
// an ultra skill: PRD 2873) no key sent reads its product's repositories through the products' storage, as the service role.
// One of the Omni App's own jobs that ended (its e2e fallback, PRD 2898 s8) refreshes its pull request's ready check on the
// App's ledger (./ready-wake.ts).

const clock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

/** The Omni App's wiring, made on the first job and kept for the process. */
let omniApp: GithubDeps | null = null;
function omniGithub(): GithubDeps {
  const app = serverEnv().githubApp;
  omniApp ??= githubDeps(app ? { appId: app.id, privateKey: app.privateKey } : null, fetch, Date.now, serverEnv().secretsMasterKey);
  return omniApp;
}

/** The product repositories of a repository, read from the products' storage. */
const productRepos = (products: ProductsRepository): ProductRepos => async (workspaceId, repo) => {
  const [rows, links, repositories] = await Promise.all([products.products(workspaceId), products.links(workspaceId), products.repositories(workspaceId)]);
  return productReposOf({ products: rows, links, repositories }, repo);
};

/** One of the Omni App's own jobs ended (PRD 2898 s8): the ready check of its pull request is refreshed on the App's ledger once
 * the response has gone, so a wake never changes what the runner's report answers; one that fails is logged. */
function wakeReady(job: AppJobEnded): void {
  const run = async () => {
    try {
      await readyWake(readyWakeStore(serviceDb()))(job);
    } catch (error) {
      log.error({ event: 'runners', outcome: 'failed', message: `the ready check of ${job.repo} was not woken: ${error instanceof Error ? error.message : String(error)}` });
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request (a script): run it now.
    void run();
  }
}

/** The rules over the service role's client, or null when this deployment has none. */
function liveRunnersService(): RunnersService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  const db = serviceDb();
  return runnersService(runnersRepository(db), clock, omniGithub(), liveNotifier(), productRepos(productsRepository(db)), checkpointsRepository(db), wakeMission, wakeReady);
}

/** A job's save (PRD 2809, s4) over the service role's client, which signs the upload links; null when this deployment has none. */
function liveCheckpointsService(): CheckpointsService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  const db = serviceDb();
  return checkpointsService(runnersRepository(db), checkpointsRepository(db), clock);
}

/** The signed-in person of the page's session, by id, or null. */
async function sessionUser(): Promise<string | null> {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user?.id ?? null;
}

export function runnersDeps(): RunnersDeps {
  const hasDb = supabaseEnv() !== null;
  return {
    connect: hasDb ? supabaseAs : null,
    session: hasDb ? sessionUser : null,
    service: liveRunnersService(),
    checkpoints: liveCheckpointsService(),
    log: (message) => { log.error({ event: 'runners', outcome: 'failed', message }); },
    timer: () => {
      const start = performance.now();
      return () => performance.now() - start;
    },
  };
}
