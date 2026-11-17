// `omni mcp` (PRD 3007, s3): the kit's own MCP server for a product's knowledge, over stdio.
//
// It speaks the few JSON-RPC messages an agent needs, one JSON object per line, by hand (no MCP library is
// bundled: L-LICENSE-2), as `../runner/t3-mcp.ts` does for T3. `initialize`, `tools/list` and `tools/call` for
// the two tools of the product's MCP route (`search_knowledge`, `get_knowledge`: the same inputs and the same
// instructions) are answered; every call is sent on through `call`, the kit's client of the route
// (`./product-mcp-client.ts`), which signs in as the kit does.
//
// - Silent until the first call: `initialize` and `tools/list` are answered from this file, so a session that
//   never searches makes no request to the Omni page (AC-6).
// - A call that cannot be answered is a tool result of one line with `isError`, never a crash and never an empty
//   list (BL-GATE-1).
// - Nothing is written but the answers on `write`: no key, no token, no file (L-GDPR-2).
import { z } from 'zod';
import { UNREACHABLE } from './product-mcp-client.ts';
import type { KnowledgeCall, KnowledgeReply } from './product-mcp-client.ts';

/** The server's instructions, the product MCP route's own words. */
const INSTRUCTIONS = [
  'The knowledge of this product, across every repository of it: its business laws, the decisions behind its architecture (ADRs), its rules and invariants, its Legal entries, its terms and its Never lines.',
  'Search it with search_knowledge before you decide anything it may settle, and read what you rely on whole with get_knowledge.',
  'Cite the ids you rely on, like BL-QUOTES-1 or shop-app/ADR-0067.',
].join(' ');

const PROTOCOL = '2025-06-18';
const KINDS = ['business-law', 'adr', 'rule', 'legal', 'term', 'never'] as const;

/** The two tools, as `tools/list` answers them. */
const TOOLS = [
  {
    name: 'search_knowledge',
    title: "Search the product's knowledge",
    description: "Searches the product's knowledge by meaning: its business laws, ADRs, rules and invariants, Legal entries, terms and Never lines, in every repository of the product. Ask in your own words: an exact id or term comes first, then the entries nearest in meaning. Filter by kind, domain or repository; with no query it lists the entries that match the filters, in id order. At most 20 hits, the best first. Read an entry whole with get_knowledge. No hit means the knowledge holds no answer to the question: say so rather than citing an unrelated entry. Cite the ids you rely on, like BL-QUOTES-1 or shop-app/ADR-0067.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', maxLength: 300, description: 'A question or plain words, like "can a quote be sent without a payment term". Leave it out to list.' },
        kind: { type: 'string', enum: KINDS, description: 'Only entries of this kind.' },
        domain: { type: 'string', maxLength: 80, description: 'Only entries of this domain, like quotes.' },
        repo: { type: 'string', maxLength: 200, description: 'Only entries of this repository, as owner/name or its short name.' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_knowledge',
    title: "Read one entry of the product's knowledge",
    description: "One entry of the product's knowledge, its body whole: an ADR's whole record, a business law's statement, Why, domains and owner, a rule's text and status. Name it by the id search_knowledge gave, like BL-QUOTES-1, shop-app/ADR-0067, L-GDPR-2, term:API key or never#6.",
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', minLength: 1, maxLength: 300, description: "The entry's id, as search_knowledge gives it." } },
      required: ['id'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

const SearchArgs = z.object({
  query: z.string().max(300).optional(),
  kind: z.enum(KINDS).optional(),
  domain: z.string().max(80).optional(),
  repo: z.string().max(200).optional(),
});
const GetArgs = z.object({ id: z.string().min(1).max(300) });

const RequestSchema = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const INVALID_JSON = -32700;
const NOT_A_REQUEST = -32600;
const NO_METHOD = -32601;
const BAD_PARAMS = -32602;

type Id = string | number | null;

/** What `serveKnowledgeMcp` is given. */
export type McpIo = {
  /** What arrives on stdin, in chunks. */
  input: AsyncIterable<string | Uint8Array>;
  /** Writes one line (its newline included) to stdout. */
  write: (line: string) => void;
  /** The one call a tool makes, to the product's MCP route. */
  call: (call: KnowledgeCall) => Promise<KnowledgeReply>;
  /** The server's version, as `initialize` says it. */
  version?: string | undefined;
};

type Reply = { result: unknown } | { error: { code: number; message: string } };

/** The `search_knowledge` call the inputs make, or the line saying what they should be. */
function searchCall(args: unknown): KnowledgeCall | string {
  const parsed = SearchArgs.safeParse(args);
  if (!parsed.success) return `search_knowledge: the inputs are query, kind, domain and repo, each text (kind one of ${KINDS.join(', ')}).`;
  const defined = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
  return { tool: 'search_knowledge', args: Object.fromEntries(defined) };
}

/** The `get_knowledge` call the inputs make, or the line saying what they should be. */
function getCall(args: unknown): KnowledgeCall | string {
  const parsed = GetArgs.safeParse(args);
  return parsed.success ? { tool: 'get_knowledge', args: { id: parsed.data.id } } : 'get_knowledge: give the id of the entry, as search_knowledge gives it.';
}

/** The call a `tools/call` names, or the line saying why it is none. */
function callOf(params: Record<string, unknown> | undefined): KnowledgeCall | string {
  const name = params?.name;
  const args = params?.arguments ?? {};
  if (name === 'search_knowledge') return searchCall(args);
  if (name === 'get_knowledge') return getCall(args);
  return `No tool ${typeof name === 'string' ? name : 'of that name'}: the tools are search_knowledge and get_knowledge.`;
}

/** A tool's text, as a result. */
const toolResult = (text: string, isError: boolean): Reply => ({ result: { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) } });

/** What `initialize` answers: the client's protocol version when it names one, the tools and the instructions. */
function initialized(params: Record<string, unknown> | undefined, io: McpIo): Reply {
  const asked = params?.protocolVersion;
  return {
    result: {
      protocolVersion: typeof asked === 'string' ? asked : PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: 'omni-knowledge', version: io.version ?? '1.0.0' },
      instructions: INSTRUCTIONS,
    },
  };
}

/** What `tools/call` answers: the route's text, or the one line saying why there is none. */
async function called(params: Record<string, unknown> | undefined, io: McpIo): Promise<Reply> {
  const call = callOf(params);
  if (typeof call === 'string') return toolResult(call, true);
  try {
    const reply = await io.call(call);
    return reply.ok ? toolResult(reply.text, false) : toolResult(reply.line, true);
  } catch {
    return toolResult(UNREACHABLE, true);
  }
}

/** The answer to one request. */
async function answer(method: string, params: Record<string, unknown> | undefined, io: McpIo): Promise<Reply> {
  if (method === 'initialize') return initialized(params, io);
  if (method === 'tools/call') return called(params, io);
  if (method === 'tools/list') return { result: { tools: TOOLS } };
  if (method === 'ping') return { result: {} };
  return { error: { code: NO_METHOD, message: `Method not found: ${method}` } };
}

/** Handles one line of input; writes its answer when it is a request. */
async function handle(line: string, io: McpIo): Promise<void> {
  const send = (id: Id, reply: Reply): void => {
    io.write(`${JSON.stringify({ jsonrpc: '2.0', id, ...reply })}\n`);
  };
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    send(null, { error: { code: INVALID_JSON, message: 'Parse error' } });
    return;
  }
  const request = RequestSchema.safeParse(raw);
  if (!request.success) {
    send(null, { error: { code: NOT_A_REQUEST, message: 'Invalid request' } });
    return;
  }
  const { id, method, params } = request.data;
  if (id === undefined) return; // a notification, such as notifications/initialized
  if (method === 'tools/call' && params !== undefined && typeof params.name !== 'string') {
    send(id, { error: { code: BAD_PARAMS, message: 'Invalid params: name the tool' } });
    return;
  }
  send(id, await answer(method, params, io));
}

/** Serves the MCP over `io` until its input ends; resolves once every call in flight is answered. */
export async function serveKnowledgeMcp(io: McpIo): Promise<void> {
  const decoder = new TextDecoder();
  const pending: Promise<void>[] = [];
  let buffer = '';
  const take = (line: string): void => {
    if (line.trim() !== '') pending.push(handle(line, io));
  };
  for await (const chunk of io.input) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(take);
  }
  take(buffer);
  await Promise.all(pending);
}
