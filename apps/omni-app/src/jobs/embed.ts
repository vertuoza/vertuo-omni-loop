// The knowledge embed as a job of the ledger (PRD 2728 s4, spec "When a pack lands: the `knowledge-embed` job"):
// once the `knowledge-pack` job kept a pack (./pack.ts), it adds this job, with the same key
// (`<owner/name>@<commit>`), and the job makes the pack's knowledge findable by meaning, for each workspace
// that keeps the pack:
//
//   build   the pack's entries, with the kit's builder the product's MCP builds them with
//           (kit/lib/knowledge/entries.ts): its ADRs and registers; its business laws when the repository is
//           a product's law home; and, for each product of the workspace holding it, the product's Legal
//           entries, Glossary terms and Never lines
//   hash    each entry's embedText() (no `Owner:` line: no person in a vector), as lower-case hex sha256 of
//           its UTF-8 bytes; the same text in two entries or two products is one hash
//   embed   only the hashes the workspace holds no vector for (knowledge_vectors_missing()), 8 a call
//           through the `embed` Edge Function (../knowledge-embed/embedder.ts), each batch kept at once
//           (knowledge_vectors_put()), so a try that stops halfway loses nothing
//
// An `embed` that fails or times out throws: the worker reads it as a `retry`, and a fifth failed try is
// `failed`, which the ledger's health check reports as `late` (PRD 2676). Meanwhile the entries are still
// found by their words. A job may run twice and is harmless: a second run finds nothing missing and embeds
// nothing. A pack too large for one run's time asks to run again a minute later, carrying on from what is
// still missing. The payload holds no token and no text (L-GDPR-2), and nothing embedded is logged.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { embedText, knowledgeEntries, type KnowledgeEntry } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { EMBED_BATCH, EMBED_MODEL } from 'omni-loop/kit/lib/knowledge/embed-contract.ts';
import type { Embedder } from '../knowledge-embed/embedder.ts';
import type { EmbedStore, WorkspacePack } from '../knowledge-embed/store.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { NewJob } from './ledger.ts';
import type { JobHandler, JobResult } from './worker.ts';

export const EMBED_KIND = 'knowledge-embed';

/** How long one run embeds before it asks to run again: well inside the worker's 240 seconds. */
const EMBED_BUDGET_MS = 150_000;
/** How long a run that ran out of time waits before the next. */
const AGAIN_MS = 60_000;

const EmbedPayloadSchema = z.object({
  repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});

/** The job a kept pack of `repository` (owner/name) at `sha` adds: the pack job's key, under this kind. */
export function embedJob({ repository, sha }: { repository: string; sha: string }): NewJob {
  const subject = repository.toLowerCase();
  return { kind: EMBED_KIND, key: `${subject}@${sha}`, subject, payload: { repository: subject, sha } };
}

/** The hash a vector is kept under: lower-case hex sha256 of the text's UTF-8 bytes. */
export const textHash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** The entries of the pack as one workspace keeps it: the repository's own, then each product's. */
export function packEntries(repository: string, pack: Pick<WorkspacePack, 'files' | 'products'>): KnowledgeEntry[] {
  const own = knowledgeEntries({ repositories: [{ repo: repository, files: pack.files }], lawHome: null, legal: [], glossary: [], never: [] });
  const products = pack.products.flatMap((product) =>
    knowledgeEntries({
      repositories: [],
      lawHome: product.lawHome ? { repo: repository, files: pack.files } : null,
      legal: product.legal,
      glossary: product.glossary,
      never: product.never,
    }),
  );
  return [...own, ...products];
}

/** Each text to embed by its hash, once, in the entries' order. */
export function textsByHash(entries: readonly KnowledgeEntry[]): Map<string, string> {
  const texts = new Map<string, string>();
  for (const entry of entries) {
    const text = embedText(entry);
    texts.set(textHash(text), text);
  }
  return texts;
}

/** The handler of the `knowledge-embed` kind: `store` is the vectors' database, `embed` the model. */
export function embedHandler({
  store,
  embed,
  clock = Date.now,
  budgetMs = EMBED_BUDGET_MS,
  log = noteTo('knowledge-embed'),
}: {
  store: EmbedStore;
  embed: Embedder;
  clock?: () => number;
  budgetMs?: number;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    const { repository, sha } = payloadOf(job.payload);
    const what = `${repository}@${sha.slice(0, 7)}`;
    const packs = await store.sources(repository, sha);
    if (packs.length === 0) return { outcome: 'skipped', reason: 'no workspace keeps its pack' };

    const start = clock();
    let embedded = 0;
    let texts = 0;
    for (const pack of packs) {
      const byHash = textsByHash(packEntries(repository, pack));
      texts += byHash.size;
      const missing = await store.missing(pack.workspace, EMBED_MODEL, [...byHash.keys()]);
      for (let at = 0; at < missing.length; at += EMBED_BATCH) {
        if (clock() - start >= budgetMs) {
          log(`knowledge embed: ${what} embedded ${String(embedded)} texts, out of time: again in a minute`);
          return { outcome: 'later', at: new Date(clock() + AGAIN_MS), progress: { embedded } };
        }
        const hashes = missing.slice(at, at + EMBED_BATCH);
        const vectors = await embed(hashes.map((hash) => byHash.get(hash) ?? ''));
        await store.put(pack.workspace, EMBED_MODEL, hashes.map((sha256, i) => ({ sha256, vector: vectors[i] ?? [] })));
        embedded += hashes.length;
      }
    }
    log(`knowledge embed: ${what} embedded ${String(embedded)} of ${String(texts)} texts in ${String(packs.length)} workspaces`);
    return { outcome: 'done' };
  };
}

/** The job's payload, or the error naming its first malformed field. */
function payloadOf(raw: unknown): z.infer<typeof EmbedPayloadSchema> {
  const parsed = EmbedPayloadSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  throw new Error(`The embed job is malformed: ${issue?.path.join('.') || '(payload)'}: ${issue?.message ?? parsed.error.message}`);
}
