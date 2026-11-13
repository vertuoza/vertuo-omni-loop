// Bug #2805: a knowledge write the Omni page takes longer than one ordinary call to save is still
// waited for. `POST /api/knowledge/changes` may run up to 30 s; the client used to cut it at the
// ordinary call's timeout, report the page unreachable, and a retry then duplicated the saved entry.
import { describe, expect, it } from 'vitest';
import { askClient } from './client.ts';

const SAVED = { done: 'applied', id: 'L-VAT-1', url: 'https://omni.test/entry/L-VAT-1' };

/** A `fetch` that answers `body` after `ms`, and gives up as the real one does when its signal aborts first. */
function slowFetch(ms: number, body: unknown): typeof globalThis.fetch {
  return (_url, init) => new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => { resolve(Response.json(body)); }, ms);
    init?.signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(init.signal?.reason instanceof Error ? init.signal.reason : new Error('aborted'));
    });
  });
}

const signedIn = {
  read: () => ({ access_token: 'access-1', refresh_token: 'refresh-1' }),
  write: () => undefined,
};

describe('a knowledge write the page is slow to save (#2805)', () => {
  it('waits for the answer past the ordinary call timeout', async () => {
    const client = askClient({ baseUrl: 'https://omni.test', host: 'omni.test', tokens: signedIn, callMs: 50, fetch: slowFetch(200, SAVED) });
    await expect(client.changeKnowledge({
      repo: 'acme/widgets', kind: 'legal', action: 'add',
      fields: { code: 'VAT', statement: 'Invoices are kept ten years.', source: 'Belgian VAT Code art. 60' },
    })).resolves.toEqual(SAVED);
  });
});
