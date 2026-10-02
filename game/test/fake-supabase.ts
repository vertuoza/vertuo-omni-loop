// A fake PostgREST over in-memory tables, for the game's tests: enough of GET (select, eq. and
// not.is.null filters, limit/offset) and of POST with on_conflict + ignore-duplicates or
// merge-duplicates (an upsert) to hold the client to the real contract. `fakeSupabase(...).fetch` stands in for fetch; `serveFake` puts the
// same fake behind a local HTTP server, for a test that runs a game script as a process.
import { createServer, type IncomingHttpHeaders } from 'node:http';

/** A row of a fake table: any columns. */
export type Row = Record<string, unknown>;
/** The fake's tables, by name. */
export type Tables = Record<string, Row[]>;
/** What a request carried, as the fake recorded it. */
export type Call = { method: string; table: string | undefined; url: URL; headers: Headers | undefined; body: unknown };
/** The headers a request may carry: the game's own, or a server's. */
export type Headers = Record<string, string> | IncomingHttpHeaders;
/** A request as the fake takes it. */
export type Init = { method?: string; headers?: Headers; body?: string };
/** An answer as the fake gives it: the part of a Response the game reads. */
export type Reply = { ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> };
/** A served fake: its address, its calls and tables, and how to stop it. */
export type Served<C> = { url: string; calls: C[]; tables: Tables; close: () => Promise<void> };

// A header's value, whichever casing and shape the request gave it.
export function header(headers: Headers | undefined, name: string): string {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : value ?? '';
}

/** Serves `fetch` on a local port, for a test that runs a game script as a process. */
export async function serve<C>(fake: { fetch: (href: string, init: Init) => Promise<Reply>; calls: C[]; tables: Tables }, contentType: (text: string) => Record<string, string>): Promise<Served<C>> {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const answer = await fake.fetch(`http://${req.headers.host}${req.url}`, { method: req.method ?? 'GET', headers: req.headers, ...(body ? { body } : {}) });
    const text = await answer.text();
    res.writeHead(answer.status, contentType(text));
    res.end(text);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('the fake server has no port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    calls: fake.calls,
    tables: fake.tables,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

const PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);

const pick = (row: Row, select: string | null): Row => (select ? Object.fromEntries(select.split(',').map((c) => [c, row[c]])) : row);

export function fakeSupabase(tables: Tables, { failOn = null }: { failOn?: string | null } = {}): { fetch: (href: string, init?: Init) => Promise<Reply>; calls: Call[]; tables: Tables } {
  const calls: Call[] = [];
  const fetch = async (href: string, init: Init = {}): Promise<Reply> => {
    const url = new URL(href);
    const table = url.pathname.split('/').pop();
    const method = init.method ?? 'GET';
    calls.push({ method, table, url, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status: number, body: unknown): Reply => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (failOn === table) return reply(503, { message: 'upstream down' });
    const rows = (tables[table ?? ''] ??= []);
    const select = url.searchParams.get('select');
    if (method === 'GET') {
      let out = rows;
      for (const [k, v] of url.searchParams) {
        if (PARAMS.has(k)) continue;
        if (v === 'not.is.null') out = out.filter((r) => r[k] !== null && r[k] !== undefined);
        else if (v.startsWith('eq.')) out = out.filter((r) => r[k] !== null && r[k] !== undefined && String(r[k]) === v.slice(3));
        else return reply(400, { message: `the fake does not know the filter ${k}=${v}` });
      }
      const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 1e9);
      return reply(200, out.slice(offset, offset + limit).map((r) => pick(r, select)));
    }
    const key = (url.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean);
    const prefer = header(init.headers, 'Prefer');
    const merge = prefer.includes('resolution=merge-duplicates');
    const inserted: Row[] = [];
    const written: Row[] = JSON.parse(init.body ?? '');
    for (const row of written) {
      const existing = key.length ? rows.find((r) => key.every((k) => r[k] === row[k])) : undefined;
      if (existing && !merge) continue;
      if (existing) Object.assign(existing, row);
      else rows.push(row);
      inserted.push(pick(existing ?? row, select));
    }
    return reply(201, prefer.includes('return=minimal') ? [] : inserted);
  };
  return { fetch, calls, tables };
}

/** The fake behind http://127.0.0.1:<port>: resolves to { url, calls, tables, close() }. */
export async function serveFake(tables: Tables, options?: { failOn?: string | null }): Promise<Served<Call>> {
  return serve(fakeSupabase(tables, options), () => ({ 'Content-Type': 'application/json' }));
}
