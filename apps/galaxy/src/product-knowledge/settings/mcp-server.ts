// The MCP server card's words and setup lines (PRD 2707 s4), pure. The URL is written from the product's own
// key, as /api/products/<key>/mcp answers it; nothing is imported from the route's code. No secret is ever
// drawn here: the setup lines carry the placeholder `oma_…`, the key itself is made on Settings › API keys.

/** What the card draws, read on the server as the signed-in person. */
export interface McpCard {
  /** The product's key, which the URL is made from; null while the product has none (the server cannot be on). */
  key: string | null;
  on: boolean;
  /** A workspace owner switches it; any other member only reads it. */
  owner: boolean;
  /** An archived product is read-only (PRD 2232). */
  archived: boolean;
  /** The address agents connect to, scheme and host only. */
  origin: string;
  /** Each repository of the product with no knowledge pack yet, as owner/name (BL-PRODUCTKNOWLEDGE-4). */
  missing: string[];
}

export const MCP_TITLE = 'MCP server';
export const OFF_LINES = ['Agents can’t read this product’s knowledge yet.', 'Then every API key reads it.'] as const;
export const ON_LINE = 'Any workspace API key reads its knowledge.';
export const OFF_NOTE = 'Stops agents on their next call.';
export const KEYS_HREF = '/app/settings/api-keys';
export const KEYS_LABEL = 'Settings › API keys';
/** With no key the server cannot be on: one line, linked to the Product key card (PRD 2784 s2). */
export const NO_KEY_LINE = 'Set the product’s key first.';
export const KEY_CARD_HREF = '#product-key';

/** The server's URL, or null when the product has no key. */
export const mcpUrl = (origin: string, key: string | null): string | null =>
  key === null ? null : `${origin.replace(/\/+$/, '')}/api/products/${key}/mcp`;

/** The line Claude Code takes to add the server. */
export const claudeCodeCommand = (key: string, url: string): string =>
  `claude mcp add --transport http ${key}-knowledge ${url} --header "Authorization: Bearer oma_…"`;

/** The entry Cursor's mcp.json takes. */
export const cursorEntry = (key: string, url: string): string =>
  JSON.stringify({ mcpServers: { [`${key}-knowledge`]: { url, headers: { Authorization: 'Bearer oma_…' } } } }, null, 2);

/** The origin agents reach this app by, from the request's host and forwarded scheme. */
export function originFrom(host: string | null, proto: string | null): string {
  const at = host ?? 'localhost:3000';
  return `${proto ?? (at.startsWith('localhost') ? 'http' : 'https')}://${at}`;
}

/** What the card draws from the product's row, the caller's role in the workspace and the repositories with no pack. */
export function cardFrom(
  row: { key: string | null; mcp_enabled: boolean; archived_at: string | null },
  role: unknown, origin: string, missing: string[],
): McpCard {
  return { key: row.key, on: row.mcp_enabled, owner: role === 'owner', archived: row.archived_at !== null, origin, missing: row.mcp_enabled ? missing : [] };
}

/** The line for a repository with no pack yet. */
export const noKnowledgeLine = (repository: string): string => `No knowledge yet from ${repository}.`;
