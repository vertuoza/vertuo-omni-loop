import { z } from 'zod';
import { reply, refuse } from '../business-api/reply';
import { ENTRY_TEXT_MAX, searchRelevant } from '../jev/decisions/search-relevant';
import { decide, type JevDecideDeps } from '../jev/resolve';
import { readSigned, why } from './signed';

// The App's relevance judge (PRD omni-loop-8 s3), a plain function of a Request so it is tested with injected
// dependencies and app/api/search/relevant/route.ts stays one line:
//
//   POST /api/search/relevant {workspaceId, productId, question, entryIds}   (at most 20 ids)
//     → 200 {verdicts: [{entryId, relevant: true | false | null, confidence}]}
//
// Signed as /api/search/categorize is (./signed.ts). Each id is judged by the workspace's `search-relevant`
// decision over the question and the entry's title and text. `relevant` is `null`, with a null confidence, for
// every id when the decision is Off (or only in Shadow), the workspace has no Jev key or no service role is
// here, Jev did not answer, answered under the confidence floor or outside the question, and for an id the
// product's knowledge does not hold. The question is never logged (L-GDPR-2). Refusals: 401 no secret here or
// a bad signature; 400 a malformed body; 413 a body past its cap; 404 no such product; 500 its knowledge could
// not be read.

const MAX_ENTRY_IDS = 20;

const BODY = z.object({
  workspaceId: z.uuid(),
  productId: z.uuid(),
  question: z.string().trim().min(1).max(2000),
  entryIds: z.array(z.string().min(1).max(300)).max(MAX_ENTRY_IDS),
}).strict();

/** An entry as the judge reads it. */
export interface JudgedEntry {
  id: string;
  title: string;
  text: string;
}

export type SearchRelevantDeps = {
  /** SEARCH_CATEGORIZE_SECRET; unset, every call is refused. */
  secret: string | undefined;
  /** The resolver's dependencies, or null without the service role: no verdict. */
  jev: JevDecideDeps | null;
  /** The entries of the product among `ids`, or null when the product is not the workspace's. */
  entriesOf: (workspaceId: string, productId: string, ids: readonly string[]) => Promise<JudgedEntry[] | null>;
  log?: (line: string) => void;
};

type Verdict = { entryId: string; relevant: boolean | null; confidence: number | null };

export async function searchRelevantRoute(request: Request, deps: SearchRelevantDeps): Promise<Response> {
  const log = deps.log ?? console.error;
  const read = await readSigned(request, deps.secret, BODY, '{workspaceId, productId, question, entryIds}: two ids, the question and at most 20 entry ids', log, 'search relevant');
  if ('refusal' in read) return read.refusal;
  const { workspaceId, productId, question, entryIds } = read.body;
  const none = (): Verdict[] => entryIds.map((entryId) => ({ entryId, relevant: null, confidence: null }));
  if (!deps.jev || entryIds.length === 0) return reply(200, { verdicts: none() });

  let entries: JudgedEntry[] | null;
  try {
    entries = await deps.entriesOf(workspaceId, productId, entryIds);
  } catch (error) {
    log(`search relevant: the product's knowledge could not be read — ${why(error)}`);
    return refuse(500, 'The product\'s knowledge could not be read. Try again.');
  }
  if (entries === null) return refuse(404, 'No such product.');
  const byId = new Map(entries.map((entry) => [entry.id, entry] as const));
  const jev = deps.jev;
  const verdicts: Verdict[] = [];
  for (const entryId of entryIds) {
    const entry = byId.get(entryId);
    if (!entry) {
      verdicts.push({ entryId, relevant: null, confidence: null });
      continue;
    }
    const counted = await decide(jev, {
      workspace: workspaceId,
      entry: searchRelevant,
      input: { question, title: entry.title, text: entry.text.slice(0, ENTRY_TEXT_MAX) },
      old: () => Promise.resolve(null),
      ref: null,
    });
    verdicts.push(counted.decidedBy === 'jev' && counted.value !== null
      ? { entryId, relevant: counted.value, confidence: counted.confidence }
      : { entryId, relevant: null, confidence: null });
  }
  return reply(200, { verdicts });
}
