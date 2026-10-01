// The MCP link (PRD 855 s2, decisions 1, 6 and 15): `/api/mcp` answers an editor's agent holding a
// read-only link (`Authorization: Bearer omb_…`) over stateless Streamable HTTP, a fresh server per
// request, JSON answers, no session id. Three tools:
//
//   get_business   {repo?}         exactly the body GET /api/business?repo= answers (decision 8)
//   get_claims     {kind?, repo?}  that body's claims, of one kind when given
//   report_unknown {question, repo?, file?}   listed; takes no question until s3 stores them
//
// The token is checked by the database: galaxy hashes it and business_for_token() reads the business
// for that hash (supabase/migrations/20261028090000_agent_tokens.sql), as nobody, with no service key
// (ADR-0051). A missing or malformed token never reaches the database; it, an unknown, a revoked token
// and one whose maker left the workspace all answer the one line LINK_REFUSED, as a tool error, so the
// agent can tell its person what to do. The body goes through businessReader(), the very parse
// readBusiness() answers with, so the two cannot differ.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { businessReader, BusinessStoreError } from '../../business-api/read';
import { hashToken, isTokenShaped } from '../tokens/token';

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export type McpDeps = {
  /** A database client acting as nobody (the anon key), or null when no database is configured. */
  connect: (() => Rpc) | null;
};

export const LINK_REFUSED = 'This link does not work: make a new one on Settings › Business.';
const NO_DATABASE = 'The business is not available here: this deployment has no database.';
const FAILED = 'The business database could not answer. Try again.';
const NOT_YET = 'Not yet: this link does not take questions yet. Tell your person this is not known, and do not guess.';

const REPO = /^[\w.-]+\/[\w.-]+$/;
const CLAIM_KINDS = ['region', 'offering', 'size', 'trade', 'rival', 'never'] as const;

const INSTRUCTIONS = [
  'The business this code is built for: who the customer is, where we sell, against whom, and what we never build.',
  'Read it with get_business (or get_claims for one kind) before deciding anything it settles, and cite the claim ids you rely on, like region#1.',
  'When no claim answers your question, call report_unknown with it instead of guessing, and tell your person it is not known yet.',
].join(' ');

const repoInput = z.string().max(200).regex(REPO, 'the repository as owner/name').optional()
  .describe('The repository you work in, as owner/name. Leave it out when the workspace sells one product.');

/** The token's SHA-256, or null when the header carries no token of the shape a link has. */
async function hashOf(header: string | null): Promise<string | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return match && isTokenShaped(match[1]) ? hashToken(match[1]) : null;
}

const text = (body: string, isError = false) => ({ content: [{ type: 'text' as const, text: body }], ...(isError ? { isError: true } : {}) });

/** The refusal's one line: the database's own reason for a bad repository, never its internals. */
function refused(error: unknown) {
  if (!(error instanceof BusinessStoreError)) throw error;
  if (error.code === '28000') return text(LINK_REFUSED, true);
  if (error.code === '42501' || error.code === '22023') return text(error.reason, true);
  console.error(`mcp: ${error.message}`);
  return text(FAILED, true);
}

function server(hash: string | null, deps: McpDeps): McpServer {
  const mcp = new McpServer({ name: 'omni-business', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  /** The read for `repo` (or the only product), as GET /api/business answers it. */
  const read = async (repo: string | undefined) => {
    if (!deps.connect) throw new BusinessStoreError('no-database', NO_DATABASE);
    if (!hash) throw new BusinessStoreError('28000', LINK_REFUSED);
    const db = deps.connect();
    // businessReader() asks for business_for_repo(); the link reads business_for_token(), same body.
    const reader = businessReader({
      rpc: ((_fn: string, args: { p_repo: string }) =>
        db.rpc('business_for_token', { p_hash: hash, p_repo: args.p_repo || null })) as never,
    });
    return reader.forRepo(repo ?? '');
  };
  const answered = async (work: () => Promise<string>) => {
    try {
      return text(await work());
    } catch (error) {
      if (error instanceof BusinessStoreError && error.code === 'no-database') return text(NO_DATABASE, true);
      return refused(error);
    }
  };

  mcp.registerTool('get_business', {
    title: 'The business',
    description: 'Who the customer is, where we sell, what we offer, against whom, and what we never build: the '
      + 'confirmed claims (and contradicted ones, flagged) and the product\'s personas. Cite the ids you rely on, '
      + 'like region#1. When no claim answers your question, call report_unknown instead of guessing.',
    inputSchema: { repo: repoInput },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ repo }) => answered(async () => JSON.stringify(await read(repo))));

  mcp.registerTool('get_claims', {
    title: 'The business\'s claims',
    description: 'The business\'s claims, of one kind when given (region, offering, size, trade, rival, never). '
      + 'Cite the ids you rely on, like region#1. When none answers your question, call report_unknown instead of guessing.',
    inputSchema: { kind: z.enum(CLAIM_KINDS).optional().describe('Only claims of this kind.'), repo: repoInput },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ kind, repo }) => answered(async () => {
    const { claims } = await read(repo);
    return JSON.stringify(kind ? claims.filter((c) => c.kind === kind) : claims);
  }));

  mcp.registerTool('report_unknown', {
    title: 'Report a question nobody answered',
    description: 'When no claim answers a question about the business, report it here instead of guessing: it '
      + 'is sent to Settings › Business for a person to answer. Then tell your person it is not known yet.',
    inputSchema: {
      question: z.string().min(1).max(300).describe('The question, in one sentence.'),
      repo: repoInput,
      file: z.string().max(300).optional().describe('The file you were working on, when it matters.'),
    },
  }, async () => text(NOT_YET));

  return mcp;
}

/** One MCP request: a fresh stateless server for the link the request carries. */
export async function handleMcp(request: Request, deps: McpDeps): Promise<Response> {
  const hash = await hashOf(request.headers.get('authorization'));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  const mcp = server(hash, deps);
  await mcp.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await mcp.close();
  }
}
