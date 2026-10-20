// The two runner rows `omni now` adds to its answer (PRD 2251's spec, §6 "The HUD band").
//
// - **runners** `{ free, slots }`: the slots free across the runners of the workspace that are online
//   (or busy) for this repository, read from the Omni page and cached 30 seconds in
//   `.omni-loop/local/runners-cache.json` (`{ at, runners }`, `runners` `null` when nothing is online or
//   the read failed: both hide the row). Not signed in: no read, no key.
// - **runner** `{ line }`: while `omni runner follow` runs here, its last milestone, read from
//   `.omni-loop/local/runner-follow/<n>.json` (`{ prd, runner, line, at }`; the file goes when the
//   follow ends): `PRD 2223 on box-1 · 1/2 slices merged`. The file written last wins.
//
// Nothing here throws. Only `readRunners` reaches the network, and `omni now` awaits it alone.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { credentialsHost } from '../ask/credentials.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { PrdNumberSchema } from '../ids.ts';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { runnerApi } from '../runner/api.ts';
import type { KitRunner } from '../runner/api.ts';
import { attempt } from './tree.ts';

/** How long a read of the runners is kept. */
export const RUNNERS_TTL_MS = 30_000;
const CACHE_FILE = 'runners-cache.json';
const FOLLOW_DIR = 'runner-follow';

/** The free and the total slots of the runners online for the repository. */
export type RunnerSlots = { free: number; slots: number };

const CacheSchema = z.object({ at: z.number(), runners: z.object({ free: z.number(), slots: z.number() }).nullable() });
const FollowSchema = z.object({ prd: PrdNumberSchema, runner: z.string().nullable(), line: z.string().min(1), at: z.iso.datetime({ offset: true }) });

/** The slots of the runners of `repo` that are online or busy; `null` when none is. */
export function slotsOf(runners: readonly KitRunner[], repo: string): RunnerSlots | null {
  const online = runners.filter((runner) => runner.state !== 'offline' && runner.repos.includes(repo));
  if (online.length === 0) return null;
  const slots = online.reduce((sum, runner) => sum + runner.slots, 0);
  const used = online.reduce((sum, runner) => sum + runner.used, 0);
  return { free: Math.max(0, slots - used), slots };
}

/** What the cache of the checkout at `root` holds at `now`: `undefined` when stale or unreadable. */
function cached(root: string, now: number): RunnerSlots | null | undefined {
  const parsed = CacheSchema.safeParse(attempt<unknown>(() => JSON.parse(readFileSync(join(root, LOCAL_DIR, CACHE_FILE), 'utf8')), null));
  if (!parsed.success || now - parsed.data.at >= RUNNERS_TTL_MS || parsed.data.at > now) return undefined;
  return parsed.data.runners;
}

/** Where `readRunners` reads: the repository, the page, the checkout, the sign-in and the page's fetch. */
export type RunnersAt = { root: string; repo: string; askUrl: string; tokens: TokenStore; fetch: Fetch; now: number };

/**
 * The slots free for the repository: the cache when it is under 30 seconds old, else a read of the
 * page (kept in the cache, a failed read too). `undefined` when nobody is signed in: nothing is asked.
 */
export async function readRunners({ root, repo, askUrl, tokens, fetch, now }: RunnersAt): Promise<RunnerSlots | null | undefined> {
  const kept = cached(root, now);
  if (kept !== undefined) return kept;
  if (!attempt(() => tokens.read(credentialsHost(askUrl)), null)) return undefined;
  let runners: RunnerSlots | null = null;
  try {
    runners = slotsOf(await runnerApi({ askUrl, tokens, fetch }).runners(repo), repo);
  } catch {
    runners = null;
  }
  attempt(() => {
    ensureLocalDir(root);
    mkdirSync(join(root, LOCAL_DIR), { recursive: true });
    writeFileSync(join(root, LOCAL_DIR, CACHE_FILE), `${JSON.stringify({ at: now, runners })}\n`);
  }, undefined);
  return runners;
}

/** The last milestone of the follow running in the checkout at `root`, as the band words it; `null` when none runs. */
export function readFollow(root: string): { line: string } | null {
  const dir = join(root, LOCAL_DIR, FOLLOW_DIR);
  const names = attempt(() => readdirSync(dir).filter((name) => name.endsWith('.json')), []);
  const files = names.flatMap((name) => {
    const parsed = FollowSchema.safeParse(attempt<unknown>(() => JSON.parse(readFileSync(join(dir, name), 'utf8')), null));
    return parsed.success ? [parsed.data] : [];
  });
  const latest = files.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  if (!latest) return null;
  return { line: `PRD ${String(latest.prd)}${latest.runner === null ? '' : ` on ${latest.runner}`} · ${latest.line}` };
}
