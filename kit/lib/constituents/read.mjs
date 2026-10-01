// A product's constituents as the kit reads them (PRD 871): its Statement (what the product is) and its
// Never list (what it must never become or do), from `GET /api/constituents?repo=` with the terminal's
// sign-in. The reply is `{ state, product, statement, never, latestEventId }` (the Omni page's
// constituents model): `state` is `ok` exactly when there is a Statement or a Never line,
// `product` is `{ name }` or null when the repository has no product, `statement` is
// `{ id: 'statement', text }` or null, and `never` is `[{ id: 'never#<n>', text }]` in order.
//
// `constituentsOf` reads a reply into that shape, its fields in the contract's order and nothing else,
// or null when it does not read as one. `printed` lays a read out as the lines `omni constituents`
// prints, and `ageOf` says how long ago a copy was synced.

const NEVER_ID = /^never#[1-9]\d*$/;
const EVENT_ID = /^\d+$/;

const isText = (value) => typeof value === 'string' && value.length > 0;

function statementOf(value) {
  if (value === null) return null;
  return value && value.id === 'statement' && isText(value.text) ? { id: 'statement', text: value.text } : undefined;
}

const neverOf = (value) => (value && typeof value.id === 'string' && NEVER_ID.test(value.id) && isText(value.text)
  ? { id: value.id, text: value.text }
  : null);

function productOf(value) {
  if (value === null) return null;
  return value && isText(value.name) ? { name: value.name } : undefined;
}

/**
 * The reply as the contract's body, or null when it does not read as one.
 * @returns {{ state: 'ok' | 'none', product: { name: string } | null, statement: { id: 'statement', text: string } | null,
 *   never: Array<{ id: string, text: string }>, latestEventId: string | null } | null}
 */
export function constituentsOf(reply) {
  if (!reply || !['ok', 'none'].includes(reply.state) || !Array.isArray(reply.never)) return null;
  const product = productOf(reply.product);
  const statement = statementOf(reply.statement);
  const never = reply.never.map(neverOf);
  if (product === undefined || statement === undefined || never.includes(null)) return null;
  const latestEventId = reply.latestEventId ?? null;
  if (latestEventId !== null && !(typeof latestEventId === 'string' && EVENT_ID.test(latestEventId))) return null;
  if ((reply.state === 'ok') !== (statement !== null || never.length > 0)) return null;
  return { state: reply.state, product, statement, never, latestEventId };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago `syncedAt` (an ISO time) was, at `now` (ms): `just now`, `5 min ago`, `3 h ago`, `2 d ago`. */
export function ageOf(syncedAt, now) {
  const ms = Math.max(0, now - Date.parse(syncedAt));
  if (ms < MINUTE) return 'just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  return `${Math.floor(ms / DAY)} d ago`;
}

/**
 * The lines a read prints, under a heading naming the product and `synced` (`synced just now`, or
 * `synced 3 d ago, offline`). A read with no product, or no constituent, is one line.
 */
export function printed(read, repo, synced) {
  if (!read.product) return [`no product for ${repo} yet (${synced}) — agents carry on`];
  if (read.state === 'none') return [`no constituents for ${read.product.name} yet (${synced}) — agents carry on`];
  const width = Math.max(...read.never.map((line) => line.id.length), 0);
  return [
    `Constituents of ${read.product.name} (${synced}): they come before every priority and the playbook.`,
    `Statement: ${read.statement ? read.statement.text : '(none yet)'}`,
    read.never.length > 0 ? 'Never:' : 'Never: (none yet)',
    ...read.never.map((line) => `  ${line.id.padEnd(width)}  ${line.text}`),
  ];
}
