// The MCP link (PRD 855 s2, decisions 1, 6 and 15): `/api/mcp` answers an editor's agent holding a
// read-only link (`Authorization: Bearer omb_…`) over stateless Streamable HTTP, a fresh server per
// request, JSON answers, no session id. Four tools:
//
//   get_business   {repo?}         exactly the body GET /api/business?repo= answers (decision 8); for an archived
//                                  product (PRD 2232) the sentence `product <name> is archived: …`, as get_claims and
//                                  get_knowledge_graph answer it
//   get_claims     {kind?, repo?}  that body's claims, of one kind when given
//   report_unknown {question, repo?, file?}   stores the question on Settings › Business (PRD 855 s3,
//                                  agent_question_report(), 20261028100000_agent_questions.sql), and says so;
//                                  a new question then goes to Jev's Unknown worth asking (s4, deps.reported)
//   get_knowledge_graph {id, depth?, repo?}   exactly the body GET /api/products/<key>/knowledge/graph
//                                  answers for the product the link resolves for `repo` (PRD 1798 s4):
//                                  knowledge_graph_for_token() reads the rows for the token, and s3's own
//                                  join and walk answer (src/knowledge-graph/link.service.ts)
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
import { ProductNeighbourhoodSchema } from 'vertuo-omni-plan/kit/lib/knowledge/product-graph.ts';
import { log } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { RpcAnswer } from '../../business/answer';
import { archivedLine, businessReader, BusinessStoreError } from '../../business-api/read';
import { linkGraphRepository } from '../../knowledge-graph/link.repository';
import { linkGraphService } from '../../knowledge-graph/link.service';
import { GRAPH_READ_REFUSALS, GraphQuerySchema } from '../../knowledge-graph/product-graph.contract';
import { hashToken, isTokenShaped } from '../tokens/token';

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export type McpDeps = {
  /** A database client acting as nobody (the anon key), or null when no database is configured. */
  connect: (() => Rpc) | null;
  /**
   * Hands a question just stored for the first time to Jev's Unknown worth asking (PRD 855 s4), to run
   * after report_unknown has answered (decision 13), with the link's token hash: the Jev step looks up the
   * link's workspace through it, and runs only when that workspace has its Jev key. Never awaited; a throw
   * is only logged.
   */
  reported?: (question: string, link: string) => void;
};

export const LINK_REFUSED = 'This link does not work: make a new one on Settings › Business.';
const NO_DATABASE = 'The business is not available here: this deployment has no database.';
const FAILED = 'The business database could not answer. Try again.';
/** What report_unknown answers once the question is stored. */
export const REPORTED = 'Sent to Settings › Business, where a person will answer it. Tell your person this is not known yet, and do not guess.';

const REPO = /^[\w.-]+\/[\w.-]+$/;
const CLAIM_KINDS = ['region', 'offering', 'size', 'trade', 'rival', 'never'] as const;

const INSTRUCTIONS = [
  'The business this code is built for: who the customer is, where we sell, against whom, and what we never build.',
  'Read it with get_business (or get_claims for one kind) before deciding anything it settles, and cite the claim ids you rely on, like region#1.',
  'When no claim answers your question, call report_unknown with it instead of guessing, and tell your person it is not known yet.',
  'For the rules, invariants and laws behind the product, in every one of its repositories, read get_knowledge_graph, and cite the ids you rely on.',
].join(' ');

const repoInput = z.string().max(200).regex(REPO, 'the repository as owner/name').optional()
  .describe('The repository you work in, as owner/name. Leave it out when the workspace sells one product.');

/** The token's SHA-256, or null when the header carries no token of the shape a link has. */
async function hashOf(header: string | null): Promise<string | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  const token = match?.[1];
  return token && isTokenShaped(token) ? hashToken(token) : null;
}

const text = (body: string, isError = false) => ({ content: [{ type: 'text' as const, text: body }], ...(isError ? { isError: true } : {}) });

/** The refusal's one line: the database's own reason for a bad repository, never its internals. */
function refused(error: unknown) {
  if (!(error instanceof BusinessStoreError)) throw error;
  if (error.code === '28000') return text(LINK_REFUSED, true);
  // 54000: the link's 31st question in 24 hours (s3), its one line as the database wrote it.
  if (error.code === '42501' || error.code === '22023' || error.code === '54000' || error.code === 'P0002') return text(error.reason, true);
  console.error(`mcp: ${error.message}`);
  return text(FAILED, true);
}

/** The one line a refused read of the knowledge graph answers: the link's, or the database's own reason. */
function graphRefused(code: string | undefined, reason: string) {
  if (code === '28000') return text(LINK_REFUSED, true);
  if (code === '42501' || code === '22023') return text(reason, true);
  // P0002: the product is archived (PRD 2232), in the sentence get_business answers.
  const archived = code === 'P0002' ? /^Product (.+) is archived/.exec(reason) : null;
  if (archived?.[1]) return text(archivedLine(archived[1]), true);
  log.error({ event: 'mcp', outcome: 'failed', fn: 'get_knowledge_graph', message: reason });
  return text(GRAPH_READ_REFUSALS.notRead, true);
}

/** The node and depth asked, as the read route takes them, or the refusal of the first one wrong. */
function graphQueryOf(id: string, depth: number | undefined) {
  const parsed = GraphQuerySchema.safeParse({ id, depth: depth === undefined ? undefined : String(depth) });
  if (parsed.success) return parsed.data;
  return text(parsed.error.issues[0]?.path[0] === 'depth' ? GRAPH_READ_REFUSALS.depth : GRAPH_READ_REFUSALS.id, true);
}

/** What agent_question_report() answers: the question's id and how many times it was asked. */
const reportSchema = z.object({ id: z.string().optional(), asked: z.number().catch(0) }).catch({ asked: 0 });

/** A PostgREST error's code and message, read as they came: either may be missing. */
function refusalOf(error: unknown): { code: string | undefined; message: string | undefined } {
  const code = propertyOf(error, 'code'), message = propertyOf(error, 'message');
  return { code: typeof code === 'string' ? code : undefined, message: typeof message === 'string' ? message : undefined };
}

/** The report the database stored, or its refusal thrown as a BusinessStoreError. */
function reportOf({ data, error }: { data: unknown; error: unknown }) {
  if (error) {
    const { code, message } = refusalOf(error);
    throw new BusinessStoreError(code, message ?? 'no answer');
  }
  return reportSchema.parse(data ?? {});
}

function server(hash: string | null, deps: McpDeps): McpServer {
  const mcp = new McpServer({ name: 'omni-business', version: '1.0.0' }, { instructions: INSTRUCTIONS });

  /** The database as nobody, for a request carrying a link's token. */
  const linked = () => {
    if (!deps.connect) throw new BusinessStoreError('no-database', NO_DATABASE);
    if (!hash) throw new BusinessStoreError('28000', LINK_REFUSED);
    return deps.connect();
  };
  /** The read for `repo` (or the only product), as GET /api/business answers it. */
  const read = async (repo: string | undefined) => {
    const db = linked();
    // businessReader() asks for business_for_repo(); the link reads business_for_token(), same body.
    const reader = businessReader({
      rpc: async (_fn, args): Promise<RpcAnswer> => {
        const repo = propertyOf(args, 'p_repo');
        const { data, error } = await db.rpc('business_for_token', { p_hash: hash, p_repo: typeof repo === 'string' && repo ? repo : null });
        if (!error) return { data, error: null };
        const { code, message } = refusalOf(error);
        return { data, error: { code: code ?? '', message: message ?? 'no answer' } };
      },
    });
    const body = await reader.forRepo(repo ?? '');
    // An archived product answers in words, never with an empty list (PRD 2232).
    if (body.state === 'archived') throw new BusinessStoreError('P0002', archivedLine(body.product?.name ?? ''));
    return body;
  };
  /** A new question to Jev, after the answer; its failure never reaches the agent. */
  const judge = (question: string) => {
    try {
      if (hash) deps.reported?.(question, hash);
    } catch (error) {
      console.error(`mcp: Unknown worth asking was not run on ${question} (${error instanceof Error ? error.message : String(error)})`);
    }
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
      + 'confirmed claims (and contradicted ones, flagged), the product\'s personas, its Legal entries and its '
      + 'glossary. Cite the ids you rely on, like region#1 or L-INVOICING-1, and use the glossary\'s words. When no claim answers your question, call report_unknown instead of guessing.',
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
  }, async ({ question, repo, file }) => answered(async () => {
    const { id, asked } = reportOf(await linked().rpc('agent_question_report', {
      p_hash: hash, p_question: question, p_repo: repo ?? null, p_file: file ?? null,
    }));
    if (asked === 1 && id) judge(id);
    return asked > 1 ? `${REPORTED} It was asked ${asked}× so far.` : REPORTED;
  }));

  mcp.registerTool('get_knowledge_graph', {
    title: 'The product\'s knowledge graph',
    description: 'The product\'s knowledge as a graph, across every repository of the product: the neighbourhood of one '
      + 'node, `depth` edges out (1 to 3, 1 by default). It holds the principles, rules, invariants and laws of each '
      + 'repository, with their tests and paths, and the product\'s Legal entries, Glossary terms and Never lines; which '
      + 'repository each node is from, each repository\'s last pushed commit (how old its graph is), and the ids that did '
      + 'not resolve. Name the node as `id`: a repository node\'s id after its repository\'s short name, like '
      + 'vertuo-omni-loop/BR-PRODUCT-3, a Legal id, like L-INVOICING-1, or term:<word>. Cite the ids you rely on, like '
      + 'L-INVOICING-1 or vertuo-omni-loop/BR-PRODUCT-3.',
    inputSchema: {
      id: z.string().describe('The node to start from: vertuo-omni-loop/BR-PRODUCT-3, L-INVOICING-1 or term:<word>.'),
      depth: z.number().optional().describe('How many edges out, from 1 to 3. 1 when left out.'),
      repo: repoInput,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id, depth, repo }) => {
    if (!deps.connect) return text(GRAPH_READ_REFUSALS.noDatabase, true);
    if (!hash) return text(LINK_REFUSED, true);
    const query = graphQueryOf(id, depth);
    if ('content' in query) return query;
    try {
      const read = await linkGraphService(linkGraphRepository(deps.connect())).neighbourhood(hash, { repo: repo ?? null, ...query });
      if (read.kind === 'refused') return graphRefused(read.code, read.reason);
      if (read.kind === 'no-node') return text(`No node ${query.id} in the knowledge graph of ${read.product}.`, true);
      return text(JSON.stringify(ProductNeighbourhoodSchema.parse(read.body)));
    } catch (error) {
      return graphRefused(undefined, error instanceof Error ? error.message : String(error));
    }
  });

  return mcp;
}

/** One MCP request: a fresh stateless server (no session id generator) for the link the request carries. */
export async function handleMcp(request: Request, deps: McpDeps): Promise<Response> {
  const hash = await hashOf(request.headers.get('authorization'));
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const mcp = server(hash, deps);
  await mcp.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await mcp.close();
  }
}
