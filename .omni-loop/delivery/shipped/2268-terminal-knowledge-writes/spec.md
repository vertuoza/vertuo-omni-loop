---
prd: 2268
title: Add and edit a product's knowledge from the terminal, one item at a time
blocked-by: none
spec: file
phase0: server
---

## Problem

Since PRD 2240 a product's Knowledge tab is the one home of its Constituents, Legal entries and
Glossary terms. The terminal can read them (`omni constituents`, `omni kb legal`, `omni kb glossary`),
but every change means leaving the terminal for the page. A person working in a Claude session who
wants to record "add a Never line: we never store card numbers" or "L-GDPR-5: …" has to switch to the
browser, find the product, and type it again.

Two things block the terminal today:

- Legal and Glossary changes go through `POST /app/products/<id>/knowledge/changes`, which accepts only
  the browser's sign-in and names the product by its id, not by the repository.
- Constituents have no route at all: the page calls `constituent_add` and `constituent_edit` straight
  from the browser.

## Solution

**Commands,** sub-commands of the reads that already exist, signed in with `omni signin` (or
`OMNI_TOKEN`), the product found from the repository:

| Item | Add | Edit |
|---|---|---|
| Statement | `omni constituents add --statement "<text>"` | `omni constituents edit statement --text "<text>"` |
| Never line | `omni constituents add --never "<text>"` | `omni constituents edit never#<n> --text "<text>"` |
| Legal entry | `omni kb legal add --code <CODE> --statement "<text>" --source "<law>"` | `omni kb legal edit L-<CODE>-<n> [--statement "<text>"] [--source "<law>"]` |
| Glossary term | `omni kb glossary add --term "<term>" --meaning "<text>" [--avoid <a,b>]` | `omni kb glossary edit "<term>" [--meaning "<text>"] [--avoid <a,b>]` |

- Each takes `--product <name>` (needed only when the repository is in more than one product) and
  `--json`.
- An edit names the item by the id the reads print, and changes only the fields given; an edit with no
  field is a usage error.
- One line on success: `added L-GDPR-5 · <the item's page>` or `edited never#3 · <page>`; for a member
  who is not the section's owner or delegate, `proposed · waits for @<owner> · <the Legal list's page>`.
- A refusal prints the database's own words and exits 1. Exit codes: 0 done or proposed, 1 refused or
  unreachable, 2 wrong usage.
- No remove and no retire from the terminal: those stay on the Knowledge tab.

**The rules are the page's, unchanged:** Legal and Glossary are saved directly by the section's named
owner or delegate (or a workspace owner while none is named) and proposed by any other member;
constituents are changed by workspace owners only, with no proposal; a Statement is one line of at
most 400 characters (BR-PRODUCT-67); an archived product is refused.

**The app:** a new route, `POST /api/knowledge/changes`, body
`{repo, product?, kind: 'legal' | 'glossary' | 'constituent', action: 'add' | 'edit', entry?, fields}`:

- It authenticates the bearer token as `/api/constituents` does (`authenticate()`, the kit token
  traded by `/api/ask/token`), then calls the database as the caller (`supabaseAs`), never with the
  service key.
- One new function, `knowledge_product_for_repo(p_repo, p_product)`, resolves the product:
  `business_workspace(repo)`, then the named product, else the repository's only product; several and
  none named refuses with their names.
- Legal and Glossary go through the existing `product-knowledge` service (`apply` or `propose`, as
  `decides` says); constituents through the existing `constituent_add` and `constituent_edit`. No
  write function changes.
- The answer: `{done: 'applied' | 'proposed', id, url}`, or `{error}` in plain words (400 malformed,
  401 signed out, 403 not allowed, 404 no such repository, product or item, 409 several products,
  422 the database's refusal, 500 the database failed).

**The kit:** `kit/lib/ask/client.ts` gains `changeKnowledge`; `kb.ts` and `constituents.ts` gain the
`add` and `edit` sub-commands; the help entries list them. `kit/dist/` is rebuilt.

**In a Claude session:** a skill, `/omni:knowledge-add`, triggered by "add a legal entry", "add a
never line", "add a glossary term", "change the statement", "edit L-GDPR-5"…:

1. It turns what the person said into **exactly one** item.
2. A field the person did not give (a Legal entry's source law, a term's meaning) is asked for,
   **never filled in by the agent**; avoid words are left empty unless the person names them.
3. It shows the item whole (kind, the id it will get or edits, every field) and asks **Yes / Change /
   Cancel**.
4. Only on Yes, it runs the command and prints its line and link.
5. Only then does it take the next item. It never writes two items from one Yes, never writes under
   `OMNI_UNATTENDED`, and edits only the item the person named.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | CLI | `omni kb legal add|edit`, `omni kb glossary add|edit`, `omni constituents add|edit` | no written convention: follows `kit/bin/commands/business.ts` (`omni business claim add`) |
| vertuo-omni-loop | route | `POST /api/knowledge/changes` | no written convention: follows `apps/galaxy/app/api/business/claims/route.ts` |
| vertuo-omni-loop | client | `changeKnowledge` | no written convention: follows `kit/lib/ask/client.ts` (`addClaim`, `readConstituents`) |
| vertuo-omni-loop | SQL | `knowledge_product_for_repo` | no written convention: follows `constituents_for_repo` in `supabase/migrations/20261129110000_product_lookups.sql` |
| vertuo-omni-loop | migration | `<timestamp>_knowledge_product_for_repo.sql` | `node scripts/migration-order.ts` (briefing › Never: newest on `main`) |
| vertuo-omni-loop | skill | `/omni:knowledge-add` | no written convention: follows `kit/plugin/skills/dossier-open/` |

## Decisions

- **The design was approved section by section** in chat on 2026-10-20 (commands and behaviour, the
  app side and data flow, errors and testing).
- **Add and edit, not remove or retire** (the person's answer).
- **Claude shows each item, asks Yes, and writes one at a time** (the person's answer).
- **A member who is not owner or delegate gets the page's behaviour** (the person's answer): a
  proposal for Legal and Glossary, a refusal for constituents.
- **Approach:** a terminal route on the app reusing the page's service and database functions, over
  the kit calling the database itself: one path, so the rules cannot drift apart.
- **The voice objected (persona:F-E Developer):** "An agent writing rules into the product from a chat
  is how a made-up law becomes something every agent obeys. I want the source law to come from the
  person's own words, never filled in by the agent." Settled **accepted**: the skill asks for every
  field the person did not give and never fills one.
- **Exit 1 on a refusal,** unlike `omni business claim add`, which always exits 0: a person typed the
  command and must see it fail; a skill reads `--json`.
- **No new top-level command:** the sub-commands live beside the reads, so the help's command count is
  unchanged.
- **No proof video** (the person's answer). E2E validation is off in this repository.

## User stories

- As a workspace owner in a terminal, I run `omni constituents add --never "We never store card
  numbers"` and see `added never#4` with its link.
- As the Legal owner, I tell Claude "add a legal entry: invoices are kept ten years, Belgian VAT Code
  art. 60"; it shows me `L-VAT-1` with both fields, I say Yes, and it is saved.
- As a member who does not own Glossary, I add a term from the terminal and see that it waits for the
  owner's approval.
- As anyone, I tell Claude three things to add; it shows and asks for each one in turn.

## Scope

In: the route and its function; the client call; the six sub-commands and their help; the skill; the
rebuilt `kit/dist/`.

Out: remove and retire from the terminal; Personas, Pitch and Settings from the terminal; proposals
for constituents; approving or rejecting proposals from the terminal; any change to the page.

## Test seams

Following `omni kb show testing` (vitest, one run; never calls GitHub):

- **Kit, end to end:** each add and edit through `main()` against `kit/test/fake-ask-server.ts`, as
  `kit/bin/business.test.ts` does: the line printed, `--json`, the exit code; each refusal (signed out,
  unreachable, 403, 404, 409, 422) exits 1 with its line; wrong usage exits 2.
- **App:** the route with a bearer token, with none (401), as owner (applied), as member (proposed),
  a member changing a constituent (403), several products without `--product` (409), an unknown item
  (404).
- **Database:** `supabase/checks/` asserts `knowledge_product_for_repo` for one product, several,
  none, another workspace's repository and an archived product.
- **Skill:** `kit/test/plugin.test.ts` asserts the skill's text holds one item per Yes, the Yes /
  Change / Cancel question, never filling a field, and no write under `OMNI_UNATTENDED`.
- **Help:** the entries for `kb` and `constituents` list the sub-commands; the command count is
  unchanged.

## Risks

- **Publishes:** a new write route on omni-loop.xyz, one additive migration (a read-only function),
  and a kit release carrying the sub-commands and the skill. Rollback: revert the feature PR; the
  function is unused without the route, and no stored shape changes (`omni kb show releasing`).
- **A terminal writing in a person's name:** every write runs as the caller's own session with the
  page's checks; the skill writes only after a Yes per item.
- **The locked laws** `omni kb laws` prints for the files this design changes:
  - BR-PRODUCT-63: an agent link reads only repositories in its own workspace. If broken, an agent
    could read or write another team's knowledge. The route resolves the repository through
    `business_workspace`, the caller's own workspaces. Changing it needs @pierrederval to approve the
    pull request on GitHub.
  - BR-PRODUCT-64: an agent link stops working when its maker leaves the workspace. If broken, a
    person who left could still change the product's rules from a terminal. A kit token's session is
    its maker's, refused once they leave. Changing it needs @pierrederval to approve the pull request
    on GitHub.
  - BR-PRODUCT-94: a terminal token can never mark an answer as given on the page. If broken, an
    agent could answer in a person's name. Unchanged: this PRD writes no answer. Changing it needs
    @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-17: no secret is ever sent to the browser. If broken, anyone could read a database key.
    The route runs on the server as the caller, never with the service key. Changing it needs
    @pierrederval to approve the pull request on GitHub.
  - BR-PRODUCT-3, BR-PRODUCT-5, BR-PRODUCT-6, BR-PRODUCT-12, BR-PRODUCT-28, BR-PRODUCT-29,
    BR-PRODUCT-39, BR-PRODUCT-59, N-PRODUCT-3, N-PRODUCT-4, N-PRODUCT-7, N-PRODUCT-8, N-PRODUCT-13,
    N-PRODUCT-14, N-PRODUCT-15, N-PRODUCT-16: printed for every path, none changed by this design.
    Changing any of them needs @pierrederval to approve the pull request on GitHub.

## Acceptance criteria

1. `omni constituents add --statement|--never` and `omni constituents edit statement|never#<n> --text`
   save as a workspace owner and print `added …` or `edited …` with the item's link; as a member they
   exit 1 with the database's refusal.
2. `omni kb legal add` and `edit`, `omni kb glossary add` and `edit` save directly for the section's
   owner or delegate and print `proposed · waits for @<owner>` for any other member; the change shows on
   the Knowledge tab.
3. An edit changes only the fields given; an edit with no field exits 2; an unknown id exits 1 naming
   it.
4. A repository in several products without `--product` exits 1 listing the products; with it, the
   change lands on that product.
5. Signed out, unreachable or refused, each command exits 1 with one plain line; `--json` prints the
   route's answer.
6. The changes are recorded as made by the person, as on the page.
7. In a Claude session, `/omni:knowledge-add` shows one item whole, asks Yes / Change / Cancel, writes
   only on Yes, asks for any field the person did not give, and takes the next item only after.
8. `omni help kb` and `omni help constituents` list the sub-commands; `kit/dist/` is rebuilt and
   `kit/test/dist.test.ts` passes.
