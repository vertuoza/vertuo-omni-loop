import { log } from 'omni-loop/kit/lib/log/log.ts';
import { messageOf } from 'omni-loop/kit/lib/narrow.ts';
import type { ApiKeysPageRead } from '../keys/api-keys.service';
import type { ApiKeysPageView } from './model';

// Settings › API keys' read (PRD 2022 s1): the workspace the person joined first, as every settings page
// heads its own; with none, the no-workspace notice. Then, through the keys' service as that person,
// whether they own it, its live keys, and for an owner the repositories an allow-list may name. The
// reads are a port so the loader is tested on fakes; ./live.ts is the page's.

export interface ApiKeysPageReads {
  /** The workspace the person joined first, or null for none. */
  workspace(): Promise<{ id: string } | null>;
  /** The keys' read of that workspace. */
  page(workspace: string): Promise<ApiKeysPageRead>;
}

export async function loadApiKeysPage(reads: ApiKeysPageReads): Promise<ApiKeysPageView> {
  try {
    const workspace = await reads.workspace();
    if (!workspace) return { kind: 'no-workspace' };
    const read = await reads.page(workspace.id);
    return { kind: 'keys', source: { kind: 'database', workspace: workspace.id }, owner: read.owner, keys: read.keys, tracked: read.tracked };
  } catch (error) {
    log.error({ event: 'api-keys-page', outcome: 'failed', message: `the page could not be read (${messageOf(error)})` });
    return { kind: 'unreadable' };
  }
}
