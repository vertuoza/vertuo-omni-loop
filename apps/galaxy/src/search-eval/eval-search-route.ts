import { z } from 'zod';
import { reply, refuse } from '../business-api/reply';
import { readSigned, why } from './signed';

// The App's eval search (PRD omni-loop-8 s3), a plain function of a Request:
//
//   POST /api/search/eval-search {workspaceId, productId, question}
//     → 200 {ids: [<entry id>, ...] (at most 10, the best first), mode: "meaning" | "words"}
//
// Signed as /api/search/categorize is (./signed.ts). It runs the product's `search_knowledge` as its MCP
// server runs it (./live.ts: the same knowledge read, the same meaning search, the same words fallback), top
// 10, and never adds a row to mcp_search_log: an eval run is no agent's search. The question is never logged
// (L-GDPR-2). Refusals: 401 no secret here or a bad signature; 400 a malformed body; 413 a body past its cap;
// 404 no such product; 500 its knowledge could not be searched.

const EVAL_TOP = 10;

const BODY = z.object({
  workspaceId: z.uuid(),
  productId: z.uuid(),
  question: z.string().trim().min(1).max(300),
}).strict();

export type SearchedIds = { ids: string[]; mode: 'meaning' | 'words' };

export type EvalSearchDeps = {
  /** SEARCH_CATEGORIZE_SECRET; unset, every call is refused. */
  secret: string | undefined;
  /** The product's search of `question`, or null when the product is not the workspace's. */
  search: (workspaceId: string, productId: string, question: string) => Promise<SearchedIds | null>;
  log?: (line: string) => void;
};

export async function evalSearchRoute(request: Request, deps: EvalSearchDeps): Promise<Response> {
  const log = deps.log ?? console.error;
  const read = await readSigned(request, deps.secret, BODY, '{workspaceId, productId, question}: two ids and the question (300 characters at most)', log, 'eval search');
  if ('refusal' in read) return read.refusal;
  const { workspaceId, productId, question } = read.body;
  let found: SearchedIds | null;
  try {
    found = await deps.search(workspaceId, productId, question);
  } catch (error) {
    log(`eval search: the product's knowledge could not be searched — ${why(error)}`);
    return refuse(500, 'The product\'s knowledge could not be searched. Try again.');
  }
  if (found === null) return refuse(404, 'No such product.');
  return reply(200, { ids: found.ids.slice(0, EVAL_TOP), mode: found.mode });
}
