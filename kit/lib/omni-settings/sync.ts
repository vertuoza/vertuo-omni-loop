/**
 * **The refresh of the local Omni-settings copy** (PRD 2417, s4): `omni sync` asks the Omni page for
 * the tech playbook of the repository's workspace's settings repository
 * (`GET /api/omni-settings/playbook`) and rewrites the copy (`./copy.ts`) from its answer.
 *
 * The copy is touched only by an answer the schema reads (`./schema.ts`) that names a settings
 * repository. Signed out, offline, refused, late, an answer that does not read, or a workspace with
 * no settings repository all leave the last copy as it was, so `omni kb show` keeps reading it; with
 * no copy and no server every form reads as it does today. Nothing here throws.
 *
 * The copy's own record (`source.json`) says when it was last refreshed: `readAt` is the time of the
 * refresh that wrote it.
 */
import { askClient, AskCallError } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { writeSettingsCopy } from './copy.ts';
import { SettingsPlaybookSchema } from './schema.ts';

/** What a refresh did: it wrote the copy, or left it as it was and why. */
export type SettingsRefresh = { state: 'refreshed'; written: string[] } | { state: 'kept'; why: string };

/** Everything a refresh needs: where the copy lives, which page to ask and as whom, and the time (ms). */
export type SettingsRefreshIo = {
  root: string;
  repo: string;
  askUrl: string;
  host: string;
  tokens: TokenStore;
  fetch: Fetch;
  budgetMs: number;
  now: number;
};

const kept = (why: string): SettingsRefresh => ({ state: 'kept', why });

/** Refreshes the Omni-settings copy under `io.root` for `io.repo`; what it did, never a throw. */
export async function refreshSettingsCopy(io: SettingsRefreshIo): Promise<SettingsRefresh> {
  const controller = new AbortController();
  const bounded: Fetch = (url, init) => io.fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal });
  const client = askClient({ baseUrl: io.askUrl, host: io.host, tokens: io.tokens, fetch: bounded });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AskCallError('GET /api/omni-settings/playbook: timed out'));
    }, io.budgetMs);
  });
  try {
    const reply = SettingsPlaybookSchema.safeParse(await Promise.race([client.readOmniSettings(io.repo), late]));
    if (!reply.success) return kept('the page’s answer did not read');
    const { repository, commit, files, reason } = reply.data;
    if (repository === null || commit === null) return kept(reason ?? 'no settings repository');
    const { written } = writeSettingsCopy({ root: io.root, files, source: { repository, commit, readAt: new Date(io.now).toISOString() } });
    return { state: 'refreshed', written };
  } catch (error) {
    return kept(error instanceof AskCallError && error.status !== null ? `the page answered ${String(error.status)}` : 'the page did not answer');
  } finally {
    clearTimeout(timer);
  }
}
