# Settled outbox items — PRD 2232

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-archived-read-only-tabs -->

## s1-01-archived-read-only-tabs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-archived-read-only-tabs
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

On an archived product's page, which tabs should its owner still see?

## The decision, in plain words

The owner keeps the tabs that only show things: Ledger, Constellation, PRDs, Ideas, Roadmap and the fixes. Questions, Knowledge and Repositories & approvers, where things are answered or edited, are hidden, and their addresses show the Ledger under the archived banner.

## The intro, for fun

A shelved product still deserves a tidy shelf.

## The punchline, for fun

Look all you like, just don't rearrange the books.

## The options, in plain words

A. A. Hide Questions, Knowledge and Repositories & approvers; their addresses show the archived Ledger (built).
B. B. Keep every tab, and show Knowledge and Repositories & approvers read-only, with no controls.
C. C. Show the Ledger alone, with no other tab.

## What I had to decide

Which tabs an archived product keeps, so its page is read-only as the spec asks. The screen library's draft leaves this open, and its mockup draws the Ledger only, with every tab still in the row.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

Built A: the three tabs that change something are left out of an archived product's row, and their addresses show the archived Ledger. The database refuses every change to an archived product anyway.

## What it costs to change later

Small: one list in the tabs module and three route pages; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading an archived product wants its Legal entries and glossary in view, read-only, was not asked.

```

<!-- /omni-outbox-settled: s1-01-archived-read-only-tabs -->

<!-- omni-outbox-settled: s1-02-archived-by-login -->

## s1-02-archived-by-login — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-archived-by-login
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The banner on an archived product says who archived it. Should it show their GitHub name or their display name?

## The decision, in plain words

It shows their GitHub name, the one the approvals and questions already use, and leaves the name out when it is not known.

## The intro, for fun

Somebody put this product on the shelf.

## The punchline, for fun

The banner names them, the way the rest of the page does.

## The options, in plain words

A. A. The GitHub name, and no name when it is unknown (built).
B. B. The display name, falling back to the GitHub name.

## What I had to decide

Which name the banner `Archived <ago> by <name>.` shows: the screen library's draft leaves it as an open question.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

Built A: the archiver's GitHub login, read from their player row in the workspace; with none, the banner reads `Archived <ago>.`.

## What it costs to change later

A one-line change in the product home's service.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether members recognise each other by GitHub name or by display name on this page was not asked.

```

<!-- /omni-outbox-settled: s1-02-archived-by-login -->

<!-- omni-outbox-settled: s1-03-archive-refusals-beyond-spec -->

## s1-03-archive-refusals-beyond-spec — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-archive-refusals-beyond-spec
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Besides the changes the spec names, should every other change to an archived product be refused too?

## The decision, in plain words

Yes: nothing about an archived product can change until it is restored. Its personas, Never lines, claims, pitch, name, approvers, Legal and glossary edits and proposals are refused, a PRD cannot be moved onto it, a roadmap push naming it is refused, and a PRD push never links repositories to it.

## The intro, for fun

The spec locked the front door and two windows.

## The punchline, for fun

We checked the back door and the cat flap too.

## The options, in plain words

A. A. Refuse every change to an archived product, the spec's named functions and the others (built).
B. B. Refuse only what the spec names, and let personas, Never lines, pitch, name, approvers and roadmap pushes still change it.

## What I had to decide

The spec names product_repository_owned(), product_knowledge_product() and product_of_key(); the slice's title says its content can no longer change. Other database functions change a product named by id, through business_product(), the approvers' and proposals' own lookups, dossier_set_product(), roadmap_push() by name and dossier_link_repositories().

## What I did meanwhile

Built A: business_product(), product_knowledge_entry_product(), product_knowledge_open(), product_approver_set() and product_approver_remove(), dossier_set_product() and roadmap_push() refuse an archived product with the archived message; dossier_link_repositories() and dossier_push()'s name pick skip it. supabase/checks/product_archive.sql proves the cases the spec names.

## What it costs to change later

A follow-up migration restoring any of these functions as they were; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Only the functions the spec names are proven by the check; the others share the same one-line guard.

```

<!-- /omni-outbox-settled: s1-03-archive-refusals-beyond-spec -->

<!-- omni-outbox-settled: s1-04-archived-read-answers -->

## s1-04-archived-read-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-archived-read-answers
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a repository's only product is archived, what should the readers that agents use answer?

## The decision, in plain words

The business read answers that the product is archived, with its name and nothing of it, and the knowledge graph read refuses with the archived sentence. A PRD whose own product is archived reads the same, rather than falling back to another product of its repository.

## The intro, for fun

An agent asks for the rules of a product that went into storage.

## The punchline, for fun

It is told the product is in storage, not that the rulebook is blank.

## The options, in plain words

A. A. The database says the product is archived, with its name, and the graph refuses with the archived sentence (built).
B. B. The database answers as if the repository had no product, and s3 asks the products table whether one was archived.

## What I had to decide

The shape the database gives the readers that s3 turns into words, since every SQL change lands in this slice. The spec names `{state: archived, product: {name}}` for the business read, and the archived sentence for the graph.

## What I did meanwhile

Built A: business_for_repo() and business_for_token() answer `{state: 'archived', business, product: {name}}` with empty lists when the lookup finds no live product and the repository (or the PRD named) points at exactly one archived one; without a repository, a link whose business sells only archived products reads one of them as archived. knowledge_graph_for_token() refuses those cases with P0002 and the archived message. A repository linked to an archived and a live product reads the live one.

## What it costs to change later

A follow-up migration and s3's readers change together; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A repository whose several products are all archived reads as in no product, not as archived.

```

<!-- /omni-outbox-settled: s1-04-archived-read-answers -->
