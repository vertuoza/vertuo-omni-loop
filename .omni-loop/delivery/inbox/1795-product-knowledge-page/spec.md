---
prd: 1795
title: Product knowledge on the Omni page: Legal and Glossary
blocked-by: none
spec: file
---

## Problem

Knowledge lives in one repository at a time. Principles, rules and invariants sit in that
repository's registers (`kit/lib/knowledge/registers.ts`), and PRD 1726 lets a CODEOWNER lock a few
of them as laws. Two kinds of knowledge do not belong to one repository:

1. **What the law requires.** "Invoice numbers follow each other with no gaps" is true for every
   repository of an invoicing product, the back end and the front end alike. Today each repository
   would have to copy it into its own register, the copies drift, and no copy says which law or
   regulation it comes from, or who answers for it.
2. **The product's words.** "Credit note, never 'refund' in the UI" is one product decision. Today a
   repository has only its own `glossary` playbook form (`paths.glossary`) and its own avoided words
   (the `design` form's `product` section, read by `kit/lib/design/words/avoid.ts`, and the config's
   `design.words.avoid`, `kit/lib/config.ts:376`). Two repositories of one product can disagree,
   and the words check of each sees only its own list.

Products already exist on the Omni page: the `products` table (`supabase/migrations/20261019090000_business_store.sql`),
their repository links (`20261129090000_product_repositories.sql`), their approvers
(`20261124090000_product_approvers.sql`) and the product home at `/app/products/<id>`
(`apps/galaxy/src/product-home/tabs.ts`). A repository finds its product with `omni product which`
and `omni product use <key>` (`kit/bin/commands/product.ts`, `kit/bin/commands/product-checkout.ts`).
Nothing on the product holds knowledge yet, and a rule's `Serves:` line can only name a principle
(`servesViolations`, `kit/lib/knowledge/check-knowledge.ts:344`).

## Solution

A product on the Omni page holds two kinds of knowledge, shared by every repository the product
links: **Legal** entries and **Glossary** terms.

### What each one holds

| Kind | Fields | Example |
|---|---|---|
| Legal entry | id `L-<CODE>-<n>`; one sentence of what the law requires; `Source law:` a link to the law or regulation; its owner, a member of the workspace | `L-INVOICING-1` — Invoice numbers follow each other with no gaps. Source law: Belgian VAT Code, art. 53. Owner: @anna |
| Glossary term | the term; its meaning in one sentence; the words to avoid in its place (zero or more) | Credit note — a document that cancels all or part of an invoice. Avoid: refund |

- `<CODE>` is one upper-case word of letters and digits, like a rule's code. The server gives `<n>`:
  the next number for that code in that product. An id is never reused, even after its entry is
  retired.
- A Legal entry is **active** or **retired**. Retiring keeps the entry and its id, and marks it
  retired. Nothing deletes a Legal entry.
- A glossary term is unique in its product, compared without case. Removing a term deletes it.

### Who changes it

Each product names, for each kind, one **owner** and one **delegate**: a Legal owner, a Legal
delegate, a Glossary owner and a Glossary delegate. Each is a member of the product's workspace.

| Who | Legal | Glossary |
|---|---|---|
| A workspace owner | names or changes the Legal owner and delegate | names or changes the Glossary owner and delegate |
| The kind's owner or delegate | adds, edits and retires entries directly; approves or rejects proposals | adds, edits and removes terms directly; approves or rejects proposals |
| Any other member of the workspace | proposes a new entry, an edit or a retirement | proposes a new term, an edit or a removal |
| Anyone outside the workspace, or signed out | reads nothing | reads nothing |

While a kind has no owner and no delegate named, the workspace's owners act as its owner. An
approved proposal changes the entry as proposed and records who approved it; a rejected one is kept,
with who rejected it, and changes nothing.

### Where it is stored

New tables in Supabase, one migration dated after the newest on `main`, written like
`20261124090000_product_approvers.sql`: every member of the workspace reads, nobody signed in writes
a table directly, and every change goes through a `security definer` function that checks the
caller's role and refuses with `42501` (not allowed), `P0002` (no such product or entry) or `22023`
(a bad value).

- `product_knowledge_owners` — product, kind (`legal`, `glossary`), role (`owner`, `delegate`),
  member.
- `product_legal` — product, code, number, statement, source law link, owner, state (`active`,
  `retired`), who changed it last and when.
- `product_glossary` — product, term, meaning, words to avoid, who changed it last and when.
- `product_knowledge_proposals` — product, kind, what it proposes (add, edit, retire or remove, with
  the proposed fields), who proposed it, state (`open`, `approved`, `rejected`), who decided it and
  when.

A new check, `supabase/checks/product_knowledge.sql`, proves each row of the table "Who changes it"
above, on fixture workspaces, the way `supabase/checks/product_approvers.sql` does.

### The product's knowledge page

A new tab on the product home, **Knowledge**, at `/app/products/<id>/knowledge`, added to
`apps/galaxy/src/product-home/tabs.ts` after Questions. It has two sections, Legal and Glossary.
Each section names its owner and delegate, lists its entries, and lists the open proposals with
Approve and Reject for the people who may decide them. A member who may only propose sees a Propose
action instead of Edit. A workspace owner sees, in each section, the control that names its owner and
delegate. The server side follows the product pages' layering
(`apps/galaxy/src/product-repositories/`: contract, controller, service, repository), in a new
`apps/galaxy/src/product-knowledge/`.

### Every repository reads it

A new route, `GET /api/products/knowledge?repo=<owner/name>&product=<key>`, answers the product's
active Legal entries and its glossary terms, in one reply, to a signed-in member, the way
`GET /api/products/targets` answers targets (`apps/galaxy/app/api/products/targets/route.ts`).
The product is the one named by `product`, else the one product the repository belongs to. A
repository in several products with no `product` given is refused, the refusal naming
`omni product use <key>`.

Two new verbs of `omni kb`, with the computer's sign-in (`signedInClient`, `kit/lib/ask/credentials.ts`):

```
omni kb legal       the product's active Legal entries, one line each
omni kb glossary    the product's glossary terms, one line each
```

- The product is the one this checkout remembers (`omni product use`), else the server's answer.
- Each read is kept in `.omni-loop/local/product-knowledge.json` (`{ product, readAt, legal,
  glossary }`), the way `kit/lib/product/targets.ts` keeps `product-targets.json`.
- When the server cannot be reached (no answer within 5 seconds, or a 5xx), the command prints the
  copy, first the line `last read <date>: the Omni page is unreachable`. With no copy, it prints
  `no product knowledge: the Omni page is unreachable and nothing was read yet` and exits 1.
- A refusal (a 4xx: no sign-in, not a member, no such product) is never hidden behind the copy: the
  command prints the server's reason and exits 1.

### A rule may serve a Legal entry

A rule's or an invariant's `Serves:` line may name one Legal entry (`Serves: L-INVOICING-1`) in
place of a principle. `servesViolations` accepts the id's shape offline. `omni check knowledge` then
verifies each served `L-` id:

- It reads the product's knowledge as `omni kb legal` does, and that read becomes the local copy.
- An id the product does not hold is a violation: `serves L-INVOICING-9, which product <name> does
  not hold.` A retired one too: `serves L-INVOICING-2, which product <name> retired.`
- When the page cannot be reached, it passes, verifies no `L-` id, and prints the note
  `Legal not verified: page unreachable`. With no sign-in, it passes with the note
  `Legal not verified: not signed in`. It never blocks on the network.
- A repository that belongs to no product and serves an `L-` id gets the violation
  `serves L-INVOICING-1, but this repository belongs to no product.` when the server answers so.
- No served `L-` id: nothing is read and nothing is printed.

The id pattern of `kit/lib/knowledge/registers.ts:132` learns `L-<CODE>-<n>`, so a citation of a
Legal id is recognised. A Legal entry is not a register entry: it has no file in the repository.

### The glossary feeds the words check

`omni design words` (`kit/bin/commands/design.ts`, `words`) adds the avoided words of the product's
glossary, read from the local copy only, to the avoid list it already builds from the `design` form
and `design.words.avoid`, without duplicates. A finding on a product word names its term:
`"refund": avoid, the product says "Credit note"`. It never calls the server; with no copy it uses
the two lists it has today.

## Decisions

- **Q4 — recommended default, accepted when the phase-0 PR merges:** Per product, on the product's Omni page, read by every repository of the product through the CLI. (Where are Legal entries and the glossary kept?)
- **Q5 — recommended default, accepted when the phase-0 PR merges:** Named owners per product, each with a delegate; other members propose. (Who edits a product's Legal and Glossary entries?)
- **Q6 — recommended default, accepted when the phase-0 PR merges:** Pass with a note, using the last copy read; never block on the network. (What does the knowledge check do when the Omni page cannot be reached?)
- **Legal and Glossary live per product on the Omni page, not in git.** Every repository of the
  product reads the same copy; no repository file holds them.
- **They are edited by named owners per product:** a Legal owner and a Glossary owner, each with a
  delegate. Other members of the workspace propose; an owner or delegate approves.
- **The offline check passes with a note.** `omni check knowledge` never blocks on the network: an
  unreachable page gives `Legal not verified: page unreachable`.
- **Legal is a new kind of entry.** The domain axis already exists and does not change.
- **While a kind has no named owner or delegate, the workspace's owners act as its owner,** so a
  new product is never stuck with proposals nobody may decide.
- **A Legal entry is retired, never deleted, and its id is never reused,** so a `Serves:` line that
  names it can always be explained.
- **The words check reads only the local copy.** `omni kb glossary` refreshes it; the words check
  stays offline and fast.
- **The new tab is named Knowledge and sits after Questions** on the product home.

## User stories

1. As a product's Legal owner, I write once what the law requires, with its source, and every
   repository of the product reads the same sentence.
2. As a member who is not the owner, I propose a Legal entry or a glossary term, and the owner
   approves or rejects it on the product's knowledge page.
3. As a workspace owner, I name who owns Legal and who owns the Glossary for each product, and who
   stands in for them.
4. As a developer in any repository of the product, I run `omni kb legal` and `omni kb glossary`
   and see the product's entries, even on a train with the copy I read last.
5. As a maintainer, I write `Serves: L-INVOICING-1` on a rule, and `omni check knowledge` tells me
   when that entry does not exist or was retired, and never fails because the page is down.
6. As a designer, the words check flags "refund" in any repository of the product, because the
   product's glossary says "Credit note".

## Scope

**In:** the four tables, their functions and policies, and the check
`supabase/checks/product_knowledge.sql`; the Knowledge tab with its Legal and Glossary sections,
proposals and owner controls; the route `GET /api/products/knowledge`; `omni kb legal` and
`omni kb glossary` with the local copy; `Serves:` naming an `L-` id and its verification in
`omni check knowledge`; the glossary's avoided words in `omni design words`; `omni help` lines for
the two verbs; `docs/guide/products.md` gains a section on product knowledge.

**Out:**
- Reminding or escalating to an owner who does not answer a proposal: P2, PRD 1794.
- Contracts between domains: P4, PRD 1796.
- The knowledge graph: P5, PRD 1797; its server API: P6, PRD 1798.
- Any change to principles, rules, invariants, domains or PRD 1726's laws and `Governs:`.
- A Legal entry locked as a law, or a CODEOWNER for a Legal entry: a Legal entry is owned on the
  Omni page only.
- Reading product knowledge in `/omni:brainstorm`, `/omni:plan` or `/omni:do-work`.
- Importing a repository's `glossary` form into a product glossary.

## Test seams

- **Database:** `supabase/checks/product_knowledge.sql`, run by the `supabase` workflow after the
  migrations, on fixture workspaces with an owner, a Legal owner, a delegate, a plain member and an
  account of another workspace. One transaction, rolled back. It proves each permission of "Who
  changes it", the id numbering and its never-reuse, retire-not-delete, a glossary term unique
  without case, and that nobody signed in writes a table directly.
- **App:** the service of `apps/galaxy/src/product-knowledge/` tested against a fake repository
  (who may decide, who may only propose, the repository in several products); the route's reply
  shape tested against a zod contract shared with the kit, as `ProductTargetsSchema` is shared; the
  Knowledge tab's component tested for an owner, a delegate, a member and a workspace owner.
- **Kit:** `kit/bin/kb.test.ts` and a new `kit/lib/product/knowledge.test.ts` on a fixture repository
  (`makeRepo()`, `kit/test/fixture.ts`), with a stubbed `fetch` as `kit/bin/commands/product-checkout.test.ts`
  does: a fresh read, a 5xx, a timeout, a 4xx, no copy. `kit/lib/knowledge/check-knowledge` tests:
  a served `L-` id held, not held, retired, the page unreachable, no sign-in, no product.
  `kit/bin/design-words.test.ts`: a product avoided word found, and no copy.
- No test calls GitHub, Supabase or the network.

## Risks

- **What a merge publishes.** The migration reaches the production database through the `supabase`
  workflow; the Knowledge tab and the route deploy with `apps/galaxy`; the two verbs and the new
  `Serves:` rule ship in `kit/dist/omni.mjs` to every repository that updates the kit. Rollback: a
  follow-up migration drops the four tables and their functions (nothing else reads them), and a
  revert of the pull request removes the tab, the route and the kit changes. A repository whose rule
  serves an `L-` id then fails `omni check knowledge` until that line is changed back to a principle.
- **A wrong answer from the page could fail a check.** Only an answer the server gives can fail it;
  no answer never does. A check run on a stale local copy is not possible: the check reads the page
  each time and uses no copy.
- **Two lists of avoided words could disagree.** The product's list is added to the repository's,
  never replaces it.
- **The locked laws this design bears on:**
  - BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees, if the
    knowledge route answered a non-member. Changing it needs @pierrederval to approve the pull
    request on GitHub.
  - BR-PRODUCT-63: an agent could read another team's private knowledge, if a sign-in read a product
    of another workspace. Changing it needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-14: a rule could quietly lose its check, if `omni check knowledge` judged a served id
    against anything but the page or the base branch's register. Changing it needs @pierrederval to
    approve the pull request on GitHub.
  - `omni kb laws --paths` prints all 17 locked laws for these files, as it does for every path.
    The other 14 (BR-PRODUCT-3, -5, -6, -12, -29, -39, -59, -64, -94, N-PRODUCT-3, -4, -7, -8, -13)
    are not changed by this design. Changing any of them needs @pierrederval to approve the pull
    request on GitHub.

## Acceptance criteria

1. On the product home, a member of the workspace sees a Knowledge tab at
   `/app/products/<id>/knowledge`, with a Legal section and a Glossary section, each naming its
   owner and delegate.
2. A workspace owner names a Legal owner, a Legal delegate, a Glossary owner and a Glossary
   delegate; a member who is not a workspace owner cannot.
3. The Legal owner adds an entry with code `INVOICING`, a sentence and a source link, and it is
   shown as `L-INVOICING-1`; the next entry with that code is `L-INVOICING-2`.
4. A retired entry keeps its id; a new entry with the same code never takes a retired number.
5. A plain member proposes a glossary term; it is not shown as a term until the Glossary owner or
   delegate approves it; a rejected proposal changes nothing.
6. With no Legal owner or delegate named, a workspace owner may approve a Legal proposal.
7. An account outside the workspace, or signed out, reads no Legal entry, no term and no proposal,
   and writes nothing (proven by `supabase/checks/product_knowledge.sql`).
8. In a signed-in checkout of a repository of the product, `omni kb legal` prints one line per
   active entry (id, sentence, source, owner) and `omni kb glossary` one line per term (term,
   meaning, words to avoid), and both write `.omni-loop/local/product-knowledge.json`.
9. With the page unreachable and a copy present, `omni kb legal` prints the copy under
   `last read <date>: the Omni page is unreachable` and exits 0; with no copy, it exits 1 with
   `no product knowledge: the Omni page is unreachable and nothing was read yet`.
10. A rule with `Serves: L-INVOICING-1` passes `omni check knowledge` when the product holds that
    active entry, and fails it, naming the id, when the product does not hold it or retired it.
11. With the page unreachable, that rule passes `omni check knowledge`, which prints
    `Legal not verified: page unreachable`; with no sign-in, it passes and prints
    `Legal not verified: not signed in`.
12. `Serves: L-invoicing-1`, or any shape that is neither a principle id nor `L-<CODE>-<n>`, fails
    `omni check knowledge` offline.
13. With a local copy whose glossary says "Credit note — avoid: refund", `omni design words` on a
    page whose marked screen says "refund" reports it and names "Credit note", without calling the
    server.
