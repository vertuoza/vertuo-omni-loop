// `/api/products/<key>/mcp` (PRD 2707 s3; ADR-0095): a product's knowledge over MCP, for any agent holding a
// workspace API key (`Authorization: Bearer oma_…`). Stateless Streamable HTTP with JSON answers, a fresh
// server per request, as `/api/mcp` is built (src/agent-connect/mcp/server.ts). Read-only, two tools:
//
//   search_knowledge {query?, kind?, domain?, repo?}  the hits, the best first, at most 20, and `total`
//   get_knowledge    {id}                             one entry, its body whole
//
// Before any MCP is spoken, the request is resolved (product-mcp.service.ts), every time:
//   no database                                     503 {error}
//   a product off, unknown, of another workspace,
//   or out of the key's reach, for a working key   404 {error: "No MCP server here."}
//   a missing, malformed, wrong or revoked key      connects, lists the tools, each call answers KEY_REFUSED
//   the database failing                            500 {error}, logged
// Nothing is kept between requests: the next call after a person leaves, or the server is turned off, reads
// nothing, and the first call after a merge reads its pack.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { hashApiKey, isApiKeyShaped } from '../public-api/keys/secret';
import {
  KEY_REFUSED, KNOWLEDGE_KINDS, NO_DATABASE, NOT_HERE, NOT_READ, noEntryLine, GetAnswerSchema, SearchAnswerSchema,
} from './product-mcp.contract';
import type { KnowledgeRead, ProductMcpService, Resolution } from './product-mcp.service';
import { searchKnowledge } from './search';

export type ProductMcpDeps = {
  /** The rules over the service role's client, or null when this deployment has no database. */
  service: ProductMcpService | null;
  /** One line for a failure: never a key, never a row. */
  log: (message: string) => void;
};

const INSTRUCTIONS = [
  'The knowledge of this product, across every repository of it: its business laws, the decisions behind its architecture (ADRs), its rules and invariants, its Legal entries, its terms and its Never lines.',
  'Search it with search_knowledge before you decide anything it may settle, and read what you rely on whole with get_knowledge.',
  'Cite the ids you rely on, like BL-QUOTES-1 or vertuo-omni-loop/ADR-0067.',
].join(' ');

const BEARER = /^Bearer[ \t]+(\S+)[ \t]*$/i;

/** The key's SHA-256, or null when the header carries no key of an API key's shape. */
async function hashOf(header: string | null): Promise<string | null> {
  const key = BEARER.exec(header ?? '')?.[1];
  return key !== undefined && isApiKeyShaped(key) ? hashApiKey(key) : null;
}

const json = (status: number, error: string): Response => Response.json({ error }, { status });

const text = (body: string, isError = false) => ({ content: [{ type: 'text' as const, text: body }], ...(isError ? { isError: true } : {}) });

function server(resolution: Exclude<Resolution, { kind: 'not-here' }>, deps: ProductMcpDeps & { service: ProductMcpService }): McpServer {
  const mcp = new McpServer({ name: 'omni-product-knowledge', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  /** The tool's answer over the knowledge read now, or the one line of a key that does not work or a read that failed. */
  const answered = async (work: (read: KnowledgeRead) => { body: string; isError?: boolean }) => {
    if (resolution.kind === 'refused') return text(KEY_REFUSED, true);
    let read: KnowledgeRead;
    try {
      read = await deps.service.read(resolution.access);
    } catch (error) {
      deps.log(`product mcp: ${error instanceof Error ? error.message : String(error)}`);
      return text(NOT_READ, true);
    }
    const { body, isError = false } = work(read);
    return text(body, isError);
  };

  mcp.registerTool('search_knowledge', {
    title: 'Search the product\'s knowledge',
    description: 'Searches the product\'s knowledge by words: its business laws, ADRs, rules and invariants, Legal entries, '
      + 'terms and Never lines, in every repository of the product the key reads. Filter by kind, domain or repository; with '
      + 'no query it lists the entries that match the filters, in id order. At most 20 hits, the best first, and `total` says how '
      + 'many matched. Read an entry whole with get_knowledge, and cite the ids you rely on, like BL-QUOTES-1 or '
      + 'vertuo-omni-loop/ADR-0067.',
    inputSchema: {
      query: z.string().max(300).optional().describe('Plain words, like "api key". Leave it out to list.'),
      kind: z.enum(KNOWLEDGE_KINDS).optional().describe('Only entries of this kind.'),
      domain: z.string().max(80).optional().describe('Only entries of this domain, like quotes.'),
      repo: z.string().max(200).optional().describe('Only entries of this repository, as owner/name or its short name.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (query) => answered((read) => ({
    body: JSON.stringify(SearchAnswerSchema.parse({ ...searchKnowledge(read.entries, query), repositories: read.repositories })),
  })));

  mcp.registerTool('get_knowledge', {
    title: 'Read one entry of the product\'s knowledge',
    description: 'One entry of the product\'s knowledge, its body whole: an ADR\'s whole record, a business law\'s statement, '
      + 'Why, domains and owner, a rule\'s text and status. Name it by the id search_knowledge gave, like BL-QUOTES-1, '
      + 'vertuo-omni-loop/ADR-0067, L-GDPR-2, term:API key or never#6.',
    inputSchema: { id: z.string().min(1).max(300).describe('The entry\'s id, as search_knowledge gives it.') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id }) => answered((read) => {
    const entry = read.entries.find((e) => e.id === id) ?? read.entries.find((e) => e.id.toLowerCase() === id.toLowerCase());
    if (entry === undefined) return { body: noEntryLine(id, read.product), isError: true };
    return { body: JSON.stringify(GetAnswerSchema.parse({ entry, repositories: read.repositories })) };
  }));

  return mcp;
}

/** One request to the product `key`'s MCP server. */
export async function handleProductMcp(request: Request, key: string, deps: ProductMcpDeps): Promise<Response> {
  const { service } = deps;
  if (service === null) return json(503, NO_DATABASE);
  let resolution: Resolution;
  try {
    resolution = await service.resolve(await hashOf(request.headers.get('authorization')), key);
  } catch (error) {
    deps.log(`product mcp: ${error instanceof Error ? error.message : String(error)}`);
    return json(500, NOT_READ);
  }
  if (resolution.kind === 'not-here') return json(404, NOT_HERE);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const mcp = server(resolution, { ...deps, service });
  await mcp.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await mcp.close();
  }
}
