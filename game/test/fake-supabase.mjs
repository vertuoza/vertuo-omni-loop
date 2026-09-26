// A fake PostgREST over in-memory tables, for the game's tests: enough of GET (select, eq. and
// not.is.null filters, limit/offset) and of POST with on_conflict + ignore-duplicates to hold the
// client to the real contract. `fakeSupabase(...).fetch` stands in for fetch; `serveFake` puts the
// same fake behind a local HTTP server, for a test that runs a game script as a process.
import { createServer } from 'node:http';

const PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);

const pick = (row, select) => (select ? Object.fromEntries(select.split(',').map((c) => [c, row[c]])) : row);

export function fakeSupabase(tables, { failOn = null } = {}) {
  const calls = [];
  const fetch = async (href, init = {}) => {
    const url = new URL(href);
    const table = url.pathname.split('/').pop();
    const method = init.method ?? 'GET';
    calls.push({ method, table, url, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
    const reply = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (failOn === table) return reply(503, { message: 'upstream down' });
    const rows = (tables[table] ??= []);
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
    const inserted = [];
    for (const row of JSON.parse(init.body)) {
      if (key.length && rows.some((r) => key.every((k) => r[k] === row[k]))) continue;
      rows.push(row);
      inserted.push(pick(row, select));
    }
    return reply(201, inserted);
  };
  return { fetch, calls, tables };
}

/** The fake behind http://127.0.0.1:<port>: resolves to { url, calls, tables, close() }. */
export async function serveFake(tables, options) {
  const fake = fakeSupabase(tables, options);
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const reply = await fake.fetch(`http://${req.headers.host}${req.url}`, {
      method: req.method, headers: req.headers, ...(body ? { body } : {}),
    });
    res.writeHead(reply.status, { 'Content-Type': 'application/json' });
    res.end(await reply.text());
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls: fake.calls,
    tables: fake.tables,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
