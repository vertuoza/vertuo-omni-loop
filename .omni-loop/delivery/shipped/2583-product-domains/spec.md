---
prd: 2583
title: A product's governed list of domains
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge]
---

## Problem

A large product is cut into domains: invoicing, planning, stock. Omni Loop half knows this.

1. **A domain is only a folder.** In a repository, `domains/<folder>/` under the knowledge root makes a
   domain (`kit/lib/knowledge/registers.ts`). Anyone can add one in a pull request, each repository
   can name the same domain differently, and the product has no idea which domains it has.
2. **The product's own knowledge has no domains.** Its Glossary is one list per product
   (`public.product_glossary`, `supabase/migrations/20261212110000_product_knowledge.sql`), rightly
   unique across the product, but nothing says which part of the product a term belongs to. In a
   product with hundreds of terms, that is the first thing a reader wants to know.
3. **Nobody can see the drift.** A knowledge base split across repositories drifts one folder at a
   time, and no page shows it.

## Solution

### Domains, on the product's Knowledge

Knowledge gains a section, **Domains**, after Glossary:
`Constituents · Personas · Legal · Glossary · Domains · Pitch · Repositories · Settings`.

- **A domain** has a key, a name and a meaning. The key is lower-case words joined by hyphens
  (`^[a-z][a-z0-9-]*$`, at most 60 characters), the same word as its folder, and never changes. The
  name (1 to 80 characters) and the meaning (1 to 400 characters) can be edited.
- **Who decides.** As Legal and Glossary: a named owner and delegate decide (`product_knowledge_owners`),
  the workspace's owners while nobody is named, and any other member proposes
  (`product_knowledge_proposals`). Every change is one more row of `product_knowledge_events`.
- **Retired, never deleted.** A retired domain stays readable behind `Retired · n`. Its key is never
  reused, in that product, even after it is retired.
- **A domain's page,** `/app/products/<id>/knowledge/domains/<key>`: its name, meaning, who wrote it, its
  history, the terms that name it and the repositories that hold its folder.

### A term's domains

A glossary term names **zero, one or several** domains of its product's list. A term that names none
is cross-domain, which is a normal term and not a missing field. Terms stay one list, unique across the
product. The Glossary list gains a `Domains` column and a filter through the address, `?domain=<key>`.

- A new link to a retired domain is refused. A link made before the domain was retired stays, and shows
  as retired.

### Not on the list

Nothing blocks. The Domains section has a region, **Not on the list**, showing the folders the list does not hold:

- **Where it reads.** The newest knowledge pack of each repository linked to the product, and of its
  plan repository, which the App's knowledge harvest already writes on every merge
  (`supabase/migrations/20261212100000_knowledge_packs.sql`). No person and no push is needed.
- **What counts.** A folder directly under `<knowledge root>/domains/`, `<knowledge root>` read from the
  pack's own config (`paths.knowledge`), `.omni-loop/knowledge` when it holds none. A plan repository's
  imported copies, under `repos/<target>/domains/`, never count: they are another repository's folders.
- **What it shows.** One row per folder not on the list, with the repositories holding it. Whoever may
  decide adds it with its key, name and meaning filled from the folder; any other member proposes the
  same. A folder whose name cannot be a key says so and offers nothing: the repository renames it.
- **A retired domain still in a repository** shows as `retired, still in <repo>`.
- **A repository with no pack yet** is listed as `not read yet`, and adds nothing to the count.
- **The count.** The sub-menu's Domains entry shows the active count and, when any exist, the number not
  on the list: `Domains 6 · 2 not on the list`. It shows on every Knowledge section, so the owner meets
  it without opening Domains.

A new product's list starts empty, so its folders simply appear here to adopt. Nothing is seeded.

### The terminal

- `omni kb domains` prints the active list, one line each, from the page or the last copy, as
  `omni kb glossary` does.
- `omni kb domains add --key <key> --name "<name>" --meaning "<text>" [--product <name>] [--json]` and
  `omni kb domains edit <key> [--name "<name>"] [--meaning "<text>"] [--product <name>] [--json]`. As
  `omni kb glossary`: they print `added`, `edited` or `proposed`. Nothing is retired from the terminal,
  as nothing is removed from it today.
- `omni kb glossary add` and `edit` gain `--domain <a,b>`; on `edit`, `--domain ''` clears them.
- `omni kb glossary` prints a term's domains on its line.
- `omni kb graph` marks each domain folder that is not on the list, `not on the product's list`, read
  from the local copy, never the network. With no copy or no product it marks nothing, and with an empty
  list it prints one line, `the product lists no domains yet`, instead of marking every folder.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_product_domains.sql` | `node scripts/migration-order.ts` (briefing › Never: newest on `main`) |
| vertuo-omni-loop | table | `product_domains`, `product_glossary_domains` | no written convention: follows `product_legal`, `product_glossary` ← `supabase/migrations/20261212110000_product_knowledge.sql:93` |
| vertuo-omni-loop | function | `product_domain_add`, `product_domain_edit`, `product_domain_retire` | no written convention: follows `product_legal_add` ← `supabase/migrations/20261212110000_product_knowledge.sql:619` |
| vertuo-omni-loop | check | `supabase/checks/product_domains.sql` | no written convention: follows `supabase/checks/product_knowledge.sql` |
| vertuo-omni-loop | route | `/app/products/<id>/knowledge/domains`, `/domains/<key>` | no written convention: follows `apps/galaxy/app/app/products/[id]/knowledge/[section]/page.tsx` |
| vertuo-omni-loop | section key | `domains` | no written convention: follows `SECTION_KEYS` ← `apps/galaxy/src/product-knowledge/knowledge-sections.ts:11` |
| vertuo-omni-loop | query string | `?domain=<key>` | no written convention: follows `?sort=`, `?show=` ← `apps/galaxy/src/product-knowledge/knowledge-sections.ts` |
| vertuo-omni-loop | module | `found-domains.ts` in `apps/galaxy/src/product-knowledge/` | no written convention: follows `apps/galaxy/src/product-knowledge/knowledge-sections.ts` |
| vertuo-omni-loop | CLI verb | `omni kb domains` | no written convention: follows `omni kb glossary` ← `kit/bin/commands/kb.ts:520` |
| vertuo-omni-loop | JSON field | `domains` on the business read and on each term | no written convention: follows `legal`, `glossary` ← `kit/lib/product/knowledge.ts:39` |

## Decisions

- **The list lives on the Omni page, not in a file,** beside Legal and Glossary, because it is the
  product's and is shared by every repository. Each repository's rules stay plain files in that
  repository, so never#6 is untouched by this PRD.
- **Visible, never blocking** (the person, in the design). No check fails anywhere on a domain. A folder
  off the list is shown for its owner to adopt.
- **Objection, `persona:Lead Engineer`:** "I'm trying to keep my teams cohesive. If nothing ever stops an
  unlisted folder, this list becomes one more page people ignore, and the drift stays." Settled
  `accepted`: the count sits on the sub-menu of every Knowledge section, and nothing blocks still.
- **Several domains per term** (the person, in the design): shared words stay findable under each domain.
- **Packs, not pushed graphs,** are what drift is read from: the App writes packs on every merge, while
  a graph waits for someone to run `omni kb graph push`.
- **No domain on Legal entries,** and no node kinds added to the knowledge graph: nobody asked for the
  first, and the second belongs to a later PRD on graph queries.

## User stories

- As a product's Domains owner, I define the product's domains once, so every repository and
  every reader uses the same words for them.
- As a member, I propose a domain, and its owner decides, so nobody adds one in passing.
- As a reader of a large glossary, I filter it by domain.
- As a domain owner, I see which folders in the repositories are not on the list, and adopt one in a
  click, so drift is visible the day it merges.
- As an agent in a terminal, I read the list and each term's domains, and `omni kb graph` tells me a
  folder is off the list.

## Scope

**In:** the two tables and the third knowledge kind; the Domains section and each domain's page; the
Glossary's column, filter and field; the Not on the list region and its count; `omni kb domains`,
`--domain`, the mark in `omni kb graph`; the local copy; `docs/guide/` and the kit's help text.

**Out:** any failing check on a domain; a domain on Legal entries or on any repository rule; new graph
node or edge kinds; a domain filter on the knowledge graph; changing how a repository lays out its
`domains/` folders; business laws in a plan repository; optional knowledge types; moving any product's
existing knowledge.

## Test seams

Following `omni kb show testing`: tests sit beside the code, and no test calls GitHub.

- **Database, `supabase/checks/product_domains.sql`:** who writes and who only proposes, a stranger reads
  nothing, a key is refused twice and after retirement, an invalid key names the field, a new link to a
  retired domain is refused and an old one stays, every change appends its event, and a domain of another
  product cannot be linked. The kinds' widened checks in `supabase/checks/product_knowledge.sql`.
- **`found-domains.ts`, a pure module:** from a pack's paths and its knowledge root to folders. Imported
  copies under `repos/` are excluded, a custom root is honoured, a file directly under `domains/` is no
  folder, a name that cannot be a key is marked.
- **`apps/galaxy/src/product-knowledge/`:** the contract, service and render tests beside the existing
  ones: the section, its page, the sub-menu's count, `not read yet`, `retired, still in <repo>`, propose
  against add, the Glossary's column and filter.
- **`kit/bin/kb.test.ts`, through `main()` on a fixture:** `omni kb domains` read, add, edit and proposed;
  `--domain` on `add` and `edit`; an older copy without `domains` still reads; the mark and the
  empty-list line in `omni kb graph`.
- Every fixture is fictional.

## Risks

**What merging publishes** (`omni kb show releasing`): one migration applied to production, a deploy of
`apps/galaxy`, and a new kit. Rollback: a follow-up migration drops the two tables, restores the kinds'
checks and restores `business_for_product()` and `business_for_repo_app()` from their last definition
(`supabase/migrations/20261217100000_archive_product.sql`); nothing else reads them.

- **Knowledge pack reads across a product's repositories** must stay a member's own: a stranger or a
  member of another workspace reads no folder name of a repository. Row-level security holds it, and
  `supabase/checks/product_domains.sql` proves it.
- **An older kit against the new server, and the reverse:** the fields only widen the replies, and a copy
  or reply without them reads as an empty list.

**The Legal entries:**

- `L-GDPR-1`, members only read a workspace's personal data: the domains' authors and the folder rows are
  read by members only.
- `L-GDPR-3`, a deleted account's personal data is erased except its decisions: `created_by` is `on delete
  set null`, as Legal and Glossary do, and the events stay.
- `L-GDPR-4`, logs recording decisions are kept for good: every domain change is one more
  `product_knowledge_events` row, never updated or deleted.

**The locked laws** (`omni kb laws --paths` on the migration, the galaxy files and the kit files; this
design changes none of them, and they are named because its paths reach them):

- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind, and nobody can tell what was decided. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, and players could no longer trust what they earned. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository, so these become ordinary tests.

1. An owner of the Domains kind adds a domain on the page, and it is listed with its key, name and meaning.
2. A member who does not decide sees `Propose`, and their domain is not on the list until it is approved.
3. A key that exists, or existed and was retired, is refused, and the refusal names the field.
4. A retired domain stays readable behind `Retired · n`, and no Delete control exists.
5. A term names none, one or several active domains, on the page and with `omni kb glossary add --domain`.
6. A new link to a retired domain is refused, and an existing one shows as retired.
7. The Glossary list filtered with `?domain=<key>` shows only that domain's terms.
8. A repository folder under `<knowledge root>/domains/` not on the list appears in Not on the list,
   with its repository, after that repository's next knowledge pack. No check fails.
9. A plan repository's folder under `repos/<target>/domains/` never appears there.
10. Adding a folder from Not on the list moves it onto the domains list in one action.
11. The sub-menu shows `Domains <n> · <k> not on the list` on every Knowledge section when `k` is above 0,
    and `Domains <n>` otherwise.
12. A repository with no pack is listed as `not read yet` and does not change the count.
13. A stranger, and a member of another workspace, reads no domain and no folder name.
14. `omni kb domains` prints the list, and offline prints its copy with its age, or one line with no copy.
15. `omni kb graph` marks a folder off the list from the copy. With no copy it marks nothing, and with an
    empty list it prints `the product lists no domains yet`.
16. A copy written before this PRD still reads, with no domains.
