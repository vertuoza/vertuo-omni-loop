// One run of `omni sync` (PRD 1990): gather each check's facts (none for a check whose level is
// `off`) and the newcomer's setup, turn them into a record with `syncStatus`, keep it in the cache,
// and return it. `setupDoneAt` comes from the last record: once written, it is carried forward.
// Nothing here prints; a gatherer that fails costs its check one `not checked` finding.
import type { Config } from '../types.ts';
import { readSyncCache, writeSyncCache } from './cache.ts';
import type { Gatherer, GatherIo, SetupFacts, SyncFacts, Unchecked } from './facts.ts';
import { kitFacts } from './kit.ts';
import { knowledgeFacts } from './knowledge.ts';
import { mainFacts } from './main.ts';
import { pageFacts } from './page.ts';
import type { SyncRecord } from './schema.ts';
import { setupFacts } from './setup.ts';
import { syncStatus } from './status.ts';

/** The setup when its gatherer fails: every step counted done, so a failure never holds a person in setup. */
const SETUP_UNREAD: SetupFacts = { claude: false, plugin: { done: true, fix: '' }, hud: { done: true, fix: '' }, signedIn: true };

/** What `gather` gave, or `fallback` when it threw. */
async function settled<F>(gather: Gatherer<F>, io: GatherIo, fallback: F | Unchecked): Promise<F | Unchecked> {
  try {
    return await gather(io);
  } catch {
    return fallback;
  }
}

/** Gathers, judges and keeps one run; the record it kept (or could not keep). */
export async function runSync(io: GatherIo): Promise<SyncRecord> {
  const { sync, repo } = io.config;
  const on = (check: keyof Config['sync']['levels']): boolean => sync.levels[check] !== 'off';
  const failed: Unchecked = { notChecked: 'the check failed' };
  const main = on('main') ? mainFacts({ cwd: io.cwd, exec: io.exec, remote: repo.remote, defaultBranch: repo.defaultBranch }) : null;
  const setup = await settled(setupFacts, io, SETUP_UNREAD);
  const facts: SyncFacts = {
    now: io.now,
    setupDoneAt: readSyncCache(io.root)?.setupDoneAt ?? null,
    defaultBranch: repo.defaultBranch,
    main,
    kit: on('kit') ? await settled(kitFacts, io, failed) : null,
    knowledge: on('knowledge') ? await settled(knowledgeFacts, io, failed) : null,
    page: on('page') ? await settled(pageFacts, io, failed) : null,
    setup: 'notChecked' in setup ? SETUP_UNREAD : setup,
  };
  const record = syncStatus(facts, sync);
  try {
    writeSyncCache(io.root, record);
  } catch {
    // A cache that cannot be written costs the status line its badge, nothing more.
  }
  return record;
}
