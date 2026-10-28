import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import { productsRepository, type ProductsRepository } from '../products/products.repository';
import { liveNotifier } from '../public-api/notify.live';
import type { RunnersDeps } from './runners.controller';
import { githubDeps } from './runners.github';
import { runnersRepository } from './runners.repository';
import { productReposOf, runnersService, type GithubDeps, type ProductRepos, type RunnersService } from './runners.service';

// The runners' real dependencies (PRD 1830 s1), for /api/runners/*: the kit's sign-in checked with the
// Auth server (a client acting as the caller's access token), the browser's from the page's session
// cookies, and the rules over the service role's client (SUPABASE_SERVICE_ROLE_KEY, server only), the
// one role that writes the two tables. Without Supabase configured (the demo galaxy) every call answers
// 503; without the service role key, too, said in its words. A job sent by a key with a link (PRD 2425 s8) pings it from
// here too: the runners' routes are where a job is claimed and reported, so they are where its status changes.
//
// Every job runs as the Omni GitHub App (PRD 2573), the App this deployment signs in with (GITHUB_APP_ID,
// GITHUB_APP_PRIVATE_KEY): its token is minted through the global fetch (./runners.github.ts), by one wiring kept
// for the server's process, so the App's bot is read from GitHub once. A mega bug fix no key sent reads its
// product's repositories through the products' storage, as the service role.

const clock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

/** The Omni App's wiring, made on the first job and kept for the process. */
let omniApp: GithubDeps | null = null;
function omniGithub(): GithubDeps {
  const app = serverEnv().githubApp;
  omniApp ??= githubDeps(app ? { appId: app.id, privateKey: app.privateKey } : null);
  return omniApp;
}

/** The product repositories of a repository, read from the products' storage. */
const productRepos = (products: ProductsRepository): ProductRepos => async (workspaceId, repo) => {
  const [rows, links, repositories] = await Promise.all([products.products(workspaceId), products.links(workspaceId), products.repositories(workspaceId)]);
  return productReposOf({ products: rows, links, repositories }, repo);
};

/** The rules over the service role's client, or null when this deployment has none. */
function liveRunnersService(): RunnersService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  const db = serviceDb();
  return runnersService(runnersRepository(db), clock, omniGithub(), liveNotifier(), productRepos(productsRepository(db)));
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
    log: (message) => { log.error({ event: 'runners', outcome: 'failed', message }); },
    timer: () => {
      const start = performance.now();
      return () => performance.now() - start;
    },
  };
}
