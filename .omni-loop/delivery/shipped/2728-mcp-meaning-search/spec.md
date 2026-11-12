---
prd: 2728
title: A product's MCP finds knowledge by meaning
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge]
---

**Date:** 2026-11-12 · **PRD:** #2728 · **After:** PRD 2707 (a product's knowledge over MCP), PRD 2676 (the job
ledger), PRD 2011 (knowledge packs) · **Touches:** `supabase/migrations/` (one migration),
`supabase/checks/knowledge_vectors.sql` (new), `supabase/functions/embed/` (new, the repository's first Edge
Function), `.github/workflows/supabase.yml` (its deploy and its check), `kit/lib/knowledge/entries.ts` (moved from
galaxy), `apps/omni-app/src/jobs/` (one job kind), `apps/galaxy/src/product-mcp/`, `scripts/eval-search.ts` (new),
`docs/guide/api.md`.

## Problem

A product's MCP server (PRD 2707) answers `search_knowledge` by words: an entry is a hit only when it holds every
word of the query. Agents ask in their own words, so they miss:

1. **A question finds nothing, or the wrong thing.** On a real product of 2,179 entries (114 business laws, 331
   ADRs, 1,555 rules, 165 terms), 12 questions as a developer's agent asks them found the right business law in
   the top 5 twice. Ten paraphrased questions, which avoid the law's own words, found it never. Small words
   ("can", "a", "without") and plurals empty the result; when all words do match, they often match an unrelated
   ADR.
2. **Key words work, but only if the agent already knows them.** The same questions cut to 2–3 key words found
   the right law in the top 5 every time. An agent that does not know the product's words cannot do that.
3. **Two ADRs can share an id.** When two records of one repository carry the same number (three such pairs exist
   in one product today), both get the id `<repo>/ADR-<n>`, and `get_knowledge` answers only one of them.

A spike measured four searches on those 22 questions (outside this repository, with the product's own content):

| search | natural (12): first · top 5 | paraphrased (10): first · top 5 |
|---|---|---|
| today: every word | 2 · 2 | 0 · 0 |
| BM25 ranking, any word, fuzzy (MiniSearch) | 5 · 9 | 1 · 4 |
| vectors, gte-small (384 dimensions) | 7 · 12 | 2 · 8 |
| rank fusion of the two | 5 · 12 | 2 · 6 |

## Solution

**Search by meaning, with a model that runs in our own stack.** Every knowledge entry is turned into a vector
once, when its pack lands. A question is turned into a vector on each search, and the entries nearest to it come
first. Exact ids and terms still win, and the word search answers whenever the vectors cannot. The tools keep
their inputs and outputs; agents change nothing.

### The model: Supabase's built-in gte-small, behind one Edge Function

`supabase/functions/embed/`, the repository's first Supabase Edge Function, runs Supabase's built-in `gte-small`
(`Supabase.ai.Session`, 384 dimensions, mean pooling, normalized). Supabase already processes the product's data,
so no new processor is added (L-GDPR-5, kept).

- `POST {texts: string[]}` answers `{model: "gte-small", vectors: number[][]}`, one vector per text, in order.
- At most 64 texts per call, each at most 2,000 characters (cut, never refused); an empty list answers no vectors.
- Only the service role gets in: the function checks the caller's JWT is the service role's (`verify_jwt` on, and
  the role claim read). Anyone else gets 401 and nothing is embedded. Nothing it receives is logged (L-GDPR-2).
- It is deployed by the `supabase` workflow, after the migrations, with `supabase functions deploy embed`.
  CI's local stack does not start the edge runtime: the tests never call the model.

### The vectors: pgvector, keyed by workspace and text

One migration, dated after the newest on `main`. It adds things and changes nothing that exists:

- The `vector` extension, in the `extensions` schema.
- `knowledge_vectors`: `workspace_id`, `model` (`gte-small`), `text_sha256` (lower-case hex of the embedded
  text's UTF-8 bytes), `embedding extensions.vector(384)`, `made_at`, `last_used_at`; primary key
  `(workspace_id, model, text_sha256)`.
  - **Keyed by content**, so an entry that did not change is never embedded twice, across commits and across
    the repositories of one workspace.
  - **Kept per workspace:** a vector of private text is private. A workspace never reads another's (BR-PRODUCT-63,
    kept).
  - Row-level security on, no policy: only the service role reads or writes it.
- `knowledge_vectors_put(p_workspace uuid, p_model text, p_rows jsonb)`: the only writer, the service role's alone.
  Each row is `{sha256, vector}`. It adds the new ones, and sets `last_used_at` on the ones it already holds. A
  vector of the wrong length is refused whole (22023), before anything is written.
- `knowledge_vectors_missing(p_workspace uuid, p_model text, p_hashes text[])`: the hashes of the list it holds no
  vector for. Service role only.
- `knowledge_nearest(p_workspace uuid, p_model text, p_hashes text[], p_query extensions.vector, p_k int)`: the
  `p_k` hashes of the list nearest to the query, by cosine distance, nearest first, with their distance. It reads
  only the given workspace's rows and only the given hashes, and sets their `last_used_at` at most once a day.
  An exact scan: no vector index (a product holds a few thousand entries).
- `knowledge_vectors_forget()`: deletes the vectors no search or job has used for 90 days (L-GDPR-4).
- `supabase/checks/knowledge_vectors.sql` proves:
  - nobody signed in, and anon, reads, writes or calls any of it;
  - one workspace's call never returns another's vectors;
  - `knowledge_nearest` orders by cosine and keeps to the hashes given;
  - a wrong-length vector is refused whole;
  - `forget` deletes only what aged out.

  The `supabase` workflow runs it (ADR-0028).

### What is embedded: never a person

`embedText(entry)` is the text a vector is made from: the entry's title, then its body without its `Owner:` line.
An owner's login is personal data: it never goes into a vector (L-GDPR-1, L-GDPR-3, kept).

### When a pack lands: the `knowledge-embed` job

The App's `knowledge-pack` job (PRD 2676), once a pack is kept, adds a job of a new kind, `knowledge-embed`, with
the same key (`<owner/name>@<commit>`), through `background_job_add()`. A job may run twice and is harmless.

1. It reads the pack's files from the store, and builds the pack's entries with the same builder the MCP uses.
   The builder moves from `apps/galaxy/src/product-mcp/entries.ts` to `kit/lib/knowledge/entries.ts`, unchanged
   but for the two rules below, so the App and galaxy build the same entries.
2. When the pack's repository is the law home of a product, the product's business laws are built with it. For
   each product holding the repository, the product's Legal entries, Glossary terms and Never lines are built too.
3. It hashes each entry's `embedText`, asks `knowledge_vectors_missing` which have no vector yet, embeds those in
   batches of 64 through `embed`, and stores them with `knowledge_vectors_put`.
4. An `embed` that fails or times out is a `retry` for the ledger: five tries, then `failed`, which the ledger's
   health check reports as `late` (PRD 2676). A pack whose vectors are not all made still serves: see the ranking.

### The search: exact first, then meaning, then words

`search_knowledge {query, kind?, domain?, repo?}` builds the entries as today and applies its filters. With a
`query`, the order is:

1. **Exact matches:** an entry whose id, or a term whose word, equals the query (case and accents ignored), so
   `BL-ORDERS-1` or `SKU` comes first.
2. **Meaning:** the query is embedded through `embed` (2-second timeout), then `knowledge_nearest` ranks the
   filtered entries' hashes, nearest first.
3. **Not embedded yet:** entries whose hash has no vector (a pack minutes old), ordered by today's word match,
   after the rest.

At most 20 hits, `total` the number of entries ranked. The answer gains one field, `mode`:

- `meaning` when step 2 ran;
- `words` when it could not (`embed` failed or timed out, no vector at all, the database refused). The whole
  answer is then today's word search, and it never errors because of the vectors.

With no `query`, the listing is today's, `mode` absent. Product entries that `knowledge_vectors_missing` reports
(a Legal entry added since the last job) are embedded by the search itself, at most 64 per call, inside the same
2-second budget; when that runs out they rank under step 3.

### Duplicate ids

When two ADRs of one repository share a number, neither keeps `<repo>/ADR-<n>`: each takes
`<repo>/<its file name without .md>` (for example `acme-api/0043-retries` and `acme-api/0043-timeouts`). Any other
entry keeps its id. `get_knowledge` then answers each of them.

### Measuring it: `pnpm eval:search`

`scripts/eval-search.ts` scores a product's MCP on a questions file: one JSON array of
`{question, expected, set}`, `set` a free label such as `natural` or `paraphrase`. It calls `search_knowledge`
for each, with the API key read from a file it is given (`--key-file`, never an argument or the environment's
echo), and prints, per set, how many expected ids came first, how many in the top 5, and the mean reciprocal rank,
then each question with its rank and `mode`.

- This repository holds a fictional fixture: an Acme product's questions (`scripts/eval-search/acme.json`) that
  match the demo seed's knowledge, so a person can score a preview.
- A real product's questions name its own knowledge and stay in its own repository (never#11): the questions of
  the product measured above live in that product's plan repository, not here.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `knowledge_vectors`, `knowledge_vectors_put()`, `knowledge_vectors_missing()`, `knowledge_nearest()`, `knowledge_vectors_forget()` | no written convention: follows `knowledge_packs` and `knowledge_pack_put()` ← supabase/migrations/20261212100000_knowledge_packs.sql |
| vertuo-omni-loop | edge | `supabase/functions/embed/index.ts` | no written convention: the repository's first Edge Function; Supabase's layout `supabase/functions/<name>/index.ts` |
| vertuo-omni-loop | job | kind `knowledge-embed`, `apps/omni-app/src/jobs/embed.ts` | no written convention: follows `PACK_KIND = 'knowledge-pack'` ← apps/omni-app/src/jobs/pack.ts:33 |
| vertuo-omni-loop | kit | `kit/lib/knowledge/entries.ts`, `embedText()` | no written convention: follows `kit/lib/knowledge/business-laws.ts` |
| vertuo-omni-loop | api | answer field `mode` | no written convention: follows the answer's `repositories` ← apps/galaxy/src/product-mcp/product-mcp.contract.ts |
| vertuo-omni-loop | script | `scripts/eval-search.ts`, `pnpm eval:search` | no written convention: follows `scripts/migration-order.ts` |

## Decisions

1. **Vectors, not a better word search** (asked: the person chose the vector PRD after the spike). The spike
   measured vectors well ahead on the questions agents really ask.
2. **The model runs in Supabase, behind one Edge Function** (asked: the person chose it over Vercel functions and
   over keywords only). No new processor, no model to ship, one place both callers use.
3. **gte-small** (taken here, measured): it scored 12 of 12 and 8 of 10 in the top 5, better than the spike's
   first model, and it is the model Supabase runs built in.
4. **Exact first, then meaning, then words, not a rank fusion** (taken here, measured): the spike's fusion scored
   below vectors alone on paraphrases. Exact ids and terms are pinned first instead.
5. **Vectors keyed by workspace and text hash** (taken here): unchanged entries are never embedded twice, and a
   workspace's vectors stay its own.
6. **No owner login in any vector** (taken here): the embedded text drops the `Owner:` line, so a vector holds no
   personal data.
7. **Word search as the fallback, with `mode` saying which ran** (taken here; settles the voice's objection
   below): the machinery being down never breaks a search.
8. **A real product's eval stays in its own repository** (taken here; never#11): this repository holds the script
   and a fictional fixture.
9. **Duplicate ADR numbers take their file name as id** (taken here): the most readable unique id, and only the
   colliding ones change.
10. **The voice: the B-E DEv objected at design** (persona:B-E DEv): *"A vector store and an edge function is a
    lot of machinery for a search box. It's fluff to me unless the plain search still answers when that machinery
    is down."* **Settled: accepted** (decision 7).

## User stories

- As a developer, I ask my agent "can an order ship without a delivery address?", and it finds the business law
  that answers it, though the law says it differently.
- As an agent, I search in my own words and get the nearest entries first, each with an id I can cite; I know from
  `mode` whether I got the meaning search or the word search.
- As a lead engineer, I score our product's MCP with `pnpm eval:search` on our own questions after each change.
- As a workspace owner, I know no person's login is turned into a vector, and no new service sees our knowledge.

## Scope

**In:** the migration and its check; the `embed` Edge Function and its deploy; the `knowledge-embed` job; the
entry builder moved to the kit, with `embedText` and the duplicate-id rule; the new ranking, its fallback and
`mode`; `pnpm eval:search` and its Acme fixture; `docs/guide/api.md` (the search, and how to score it).

**Out:** a vector index; another model, or a hosted embedding API; changing the tools' inputs; embedding for
`/api/mcp` (the agent links); a page showing the eval; re-ranking with a language model.

## Test seams

Following `omni kb show testing`: no test calls GitHub, a model or the Edge Function; every fixture is fictional
(never#11, never#12).

- **`kit/lib/knowledge/entries.test.ts`** (moved with the builder): its cases, plus duplicate ADR numbers taking
  their file names, and `embedText` leaving out the `Owner:` line.
- **`apps/galaxy/src/product-mcp/search.test.ts`**, pure, with fake vectors:
  - an exact id, then an exact term, come first;
  - then the vector order;
  - entries with no vector come after, by word match;
  - filters apply before ranking;
  - with no vector at all, the answer is today's word search with `mode: "words"`.
- **`product-mcp.controller.test.ts`**, through the real MCP client with a fake embedder:
  - `mode: "meaning"` when it answers;
  - `mode: "words"` when it throws or passes the 2-second timeout, with the same hits as today;
  - missing product entries embedded within the budget.
- **`apps/omni-app/src/jobs/embed.test.ts`**, with a fake store and a fake embedder:
  - only missing hashes are embedded, in batches of 64;
  - the law home's business laws and the product rows are included;
  - a failing embedder is a `retry`;
  - the pack job adds the `knowledge-embed` job once its pack is kept.
- **The Edge Function's handler** as a pure function, with a fake model session: its limits, the service-role
  check and the shape of its answer.
- **`supabase/checks/knowledge_vectors.sql`:** every rule of **The vectors**.
- **`scripts/eval-search.test.ts`:** scoring (first, top 5, mean reciprocal rank) on a fake MCP, and the key read
  from its file, never printed.

## Risks

**What merging publishes:**
- the `vector` extension and one additive migration;
- the repository's first Edge Function and its deploy step;
- a new job kind;
- a new search order behind the same tools.

Until the job has run, every search answers with `mode: "words"`, exactly as today.

**Rollback:** revert the PR. Searches then go back to words, and the job kind has no handler (the worker skips
it). A follow-up migration drops the five functions and the table, and `supabase functions delete embed` removes
the function.

**What could go wrong:**
- **Cost.** The edge runtime bills each call. A pack embeds only its changed entries, and a search embeds one
  question.
- **The 2-second budget.** It bounds a slow model, which then answers by words.
- **The scores.** They come from 22 questions on one product, a small sample.

**The Legal entries it touches:**
- L-GDPR-1 (only a workspace's members read its personal data): kept. Vectors hold no owner login, and are kept
  per workspace, service role only.
- L-GDPR-2 (credentials never stored or logged in clear): kept. `pnpm eval:search` reads the key from a file and
  never prints it, and the Edge Function logs nothing it receives.
- L-GDPR-3 (a person's data erased on deletion): kept. No vector holds a person's data.
- L-GDPR-4 (non-decision logs have a retention): kept. Vectors unused for 90 days are deleted.
- L-GDPR-5 (every processor named, with an agreement): kept. The model runs in Supabase, already named, so no new
  processor is added.

**The locked laws it touches:**
- BR-PRODUCT-63: an agent could read another team's private work. Kept: vectors are kept and read per workspace,
  and the search reads only the workspace its key reaches. Changing it needs @pierrederval or @dervalp to approve
  the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Kept: the key check of
  PRD 2707 runs before any vector is read. Changing it needs @pierrederval or @dervalp to approve the pull request
  on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, N-PRODUCT-16: the new migration sits
  in the folder these laws govern, but none of their tables or functions changes. Changing any of them needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

**The business laws:**
- BL-ACCESS-1 (when a person leaves a workspace, every access they had through it ends at once): kept. Every
  search first runs PRD 2707's key check, which reads nothing for a key whose maker is no longer a member, on the
  very next call. Vectors are read only after it, and hold no person's data.
- BL-PRODUCTKNOWLEDGE-1, -2, -3 (who changes Legal and Glossary entries, their history, retiring them): kept. This
  PRD only reads those entries to embed them; it proposes, changes, records and retires nothing.
- BL-PRODUCTKNOWLEDGE-4 (a merge that changes a repository's knowledge reaches its product without anyone doing
  anything; when it cannot, a person is told): kept.
  - **Nobody acts:** the merge's pack is found by the word search the moment it is kept, as today. The
    `knowledge-embed` job the pack job adds by itself then makes it found by meaning, with nobody acting.
  - **When it cannot, a person is told:** a job that fails five times is `failed` on the job ledger, and the App's
    health check (`background_jobs_health`, PRD 2676) reports `late`, as for a pack that cannot be kept. Meanwhile
    the entries are still found by their words, never hidden.

## Acceptance criteria

- **Meaning on a real product.** After the deploy, `pnpm eval:search <the measured product's key> <its questions file>`, run
  by a person with the product's 22 questions, puts the expected entry in the top 5 for at least 11 of the 12
  natural questions and 7 of the 10 paraphrased ones, every answer with `mode: "meaning"`.
- **Exact first.** A search for an entry's exact id, or a term's exact word, answers that entry first.
- **The fallback.** With `embed` down, or slower than 2 seconds, `search_knowledge` answers today's word search with
  `mode: "words"`, never an error.
- **A fresh pack.** A merge that adds a business law makes it a hit by meaning once its `knowledge-embed` job has
  run, with nobody doing anything. Until then it is still found by its words.
- **Only what changed.** A second pack in which one entry changed embeds that one entry.
- **No person in a vector.** No embedded text holds an `Owner:` line.
- **Workspaces apart.** One workspace's search never reads another's vectors (`supabase/checks/knowledge_vectors.sql`).
- **Service role only.** The `embed` function answers 401 to any caller but the service role, and embeds nothing.
- **Duplicate ids.** Two ADRs of one repository that share a number are each found by `get_knowledge`, under their
  file names.
- **Nothing else moves.** With no `query`, `search_knowledge` lists as today. `get_knowledge` answers as today.
  `/api/mcp` is unchanged.
