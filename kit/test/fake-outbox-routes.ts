// A fake of the Omni page's outbox routes (PRD 1548 s7), held in memory, for the kit's tests of the `server`
// outbox store: `GET /api/outbox/items`, `POST /api/outbox/items` and `POST /api/outbox/items/settle`,
// answering as the Omni page's outbox controller does, on the rules of the outbox RPCs
// (supabase/migrations/20261204090000_outbox_items.sql): an item is put or rewritten while open, a medium
// one adopted at once, an open one settled once; nothing is deleted. It knows the product PRDs it is
// given and refuses any other, 404; with `down` set, every call fails as an unreachable server does.
import type { Fetch } from '../lib/ask/client.ts';
import { propertyOf } from '../lib/narrow.ts';
import { parseOutboxItem } from '../lib/outbox/outbox.ts';

/** One stored settlement. */
type Settlement = { verdict: string; basis: string; answer: string | null; settledAt: string };

/** One stored item, its settlement or none. */
type Row = { item: string; rank: string; body: string; settlement: Settlement | null };

const AT = '2026-10-11T12:00:00Z';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status });
const refuse = (status: number, error: string): Response => json(status, { error });
const text = (body: unknown, name: string): string => String(propertyOf(body, name) ?? '');

/** The product PRD a body or a query names: `<product>-<prd>`. */
const prdIdOf = (product: unknown, prd: unknown): string => `${String(product)}-${String(prd)}`;

/** A fake of the routes for the product PRDs `prds` (`mobile-12`), each with no item yet. */
export function fakeOutboxRoutes({ prds = ['mobile-12'] }: { prds?: readonly string[] } = {}) {
  const store = new Map<string, Row[]>(prds.map((prd) => [prd, []]));
  const calls: { method: string; url: string; body: unknown }[] = [];
  const state = { down: false };

  /** Why the item `body` may not be put on `rows`, or null when it may. */
  function putRefusal(rows: Row[], body: unknown): Response | null {
    const parsed = parseOutboxItem(text(body, 'body'), { file: null });
    if (!parsed.ok) return refuse(400, `The body is not an outbox item: ${parsed.errors.join('; ')}`);
    const { item } = parsed;
    if (item.prd !== prdIdOf(propertyOf(body, 'product'), propertyOf(body, 'prd'))) return refuse(400, `The item belongs to PRD ${item.prd}.`);
    if (rows.find((row) => row.item === item.id)?.settlement) return refuse(409, `Item ${item.id} is already settled: it never changes.`);
    if (propertyOf(body, 'adopt') === true && item.rank !== 'medium') return refuse(422, `Only a medium item is adopted when it is raised: ${item.id} is ${item.rank}.`);
    return null;
  }

  function put(rows: Row[], body: unknown): Response {
    const refused = putRefusal(rows, body);
    if (refused) return refused;
    const parsed = parseOutboxItem(text(body, 'body'), { file: null });
    const { id, rank } = parsed.ok ? parsed.item : { id: '', rank: '' };
    const row: Row = { item: id, rank, body: text(body, 'body'), settlement: null };
    const index = rows.findIndex((kept) => kept.item === id);
    rows.splice(index < 0 ? rows.length : index, index < 0 ? 0 : 1, row);
    const adopt = propertyOf(body, 'adopt') === true;
    if (adopt) row.settlement = { verdict: 'adopted', basis: 'adopted-when-raised', answer: null, settledAt: AT };
    return json(200, { id: `id-${id}`, item: id, ...(adopt ? { verdict: 'adopted', settledAt: AT } : { open: true }) });
  }

  function settle(rows: Row[], body: unknown): Response {
    const kept = rows.find((row) => row.item === propertyOf(body, 'item'));
    if (!kept) return refuse(404, `No item ${text(body, 'item')}.`);
    if (kept.settlement) return refuse(409, `Item ${kept.item} is already settled (${kept.settlement.verdict}).`);
    const verdict = text(body, 'verdict');
    if (verdict !== 'agreed' && verdict !== 'drifted') return refuse(422, 'An answer\'s verdict is agreed or drifted.');
    kept.settlement = { verdict, basis: text(body, 'basis'), answer: text(body, 'answer'), settledAt: AT };
    return json(200, { id: `s-${kept.item}`, item: kept.item, verdict, settledAt: AT });
  }

  /** The answer to one call, on the PRD it names. */
  function answer(method: string, url: URL, body: unknown): Response {
    const query = url.searchParams;
    const prdId = method === 'GET' ? prdIdOf(query.get('product'), query.get('prd')) : prdIdOf(propertyOf(body, 'product'), propertyOf(body, 'prd'));
    const rows = store.get(prdId);
    if (!rows) return refuse(404, `No PRD ${prdId} in your workspaces.`);
    const route = `${method} ${url.pathname}`;
    if (route === 'POST /api/outbox/items') return put(rows, body);
    if (route === 'POST /api/outbox/items/settle') return settle(rows, body);
    return json(200, { prdId, items: rows.map((row) => ({ ...row })) });
  }

  const fetch: Fetch = (target, init) =>
    new Promise((resolve, reject) => {
      const url = new URL(target);
      const method = init.method ?? 'GET';
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url: `${url.pathname}${url.search}`, body });
      if (state.down) reject(new TypeError('fetch failed'));
      else resolve(answer(method, url, body));
    });

  return {
    fetch,
    calls,
    /** Every row of `prd`, as stored. */
    rows: (prd: string): readonly Row[] => store.get(prd) ?? [],
    /** Takes the server down, or brings it back. */
    setDown: (down: boolean) => { state.down = down; },
  };
}
