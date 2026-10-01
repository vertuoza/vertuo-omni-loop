---
prd: 748
title: The business store
blocked-by: none
spec: file
---

# The business store

**Date:** 2026-09-30 · **PRD:** #748 · **From:** concept #746, area `business-core` (the wedge)
**Touches:**
- `supabase/migrations/` (one new file)
- `supabase/checks/business.sql` (new), and a step for it in `.github/workflows/supabase.yml`
- `apps/galaxy/src/business/` (new)
- `apps/galaxy/app/app/settings/business/` (new)
- `apps/galaxy/app/api/business/` (new)
- `apps/galaxy/src/nav/` (the Settings tab)
- `apps/galaxy/src/repositories/` (a product select)
- `kit/bin/commands/business.mjs` (new), `kit/lib/ask/client.mjs`, `kit/lib/help/entries.mjs`
- `kit/test/fake-ask-server.mjs`
- `kit/plugin/skills/think-big/SKILL.md`

## Problem

Omni Loop ships software for a business it knows nothing about. The knowledge folder, the code and
the docs are engineering doctrine: no agent knows that Vertuoza is an ERP sold to construction firms
of 2 to 50 people in Belgium, or who it competes with. So `/omni:think-big` and `/omni:brainstorm`
design for nobody in particular, and a person has to retype the ICP and the competitors into every
brief.

Concept #746 crowned a store of business *claims* that every agent reads. This PRD is its wedge: the
smallest chain that passes the concept's success test, which is:

> a `/omni:think-big` on a Vertuoza repository cites the ICP and a named competitor without anyone
> typing them.

It passes that test without evidence drafting, which is a later area.

## Solution

**The store.** Each workspace has at most one **business**, which holds one or more **products**.
Every tracked repository points at one product. Each business fact is one **claim**, carrying:

- **a kind:** `region`, which belongs to the business, or `offering`, `size`, `trade` and `rival`,
  which belong to a product;
- **a value**, a **source** and a **state**;
- **a receipt**, when there is one;
- **a sequence number**, which gives it its display id, `<kind>#<seq>` (for example `rival#4`). The
  sequence counts every claim of the business whatever its kind, so each number names one claim.

The business is created the first time someone opens its page. Nothing is ever seeded: an empty
workspace shows the empty sentence.

**Settings › Business** is a new Settings tab, beside Fleets and Repositories (vision steps 1 and 8
of concept #746).
- **Empty.** The page title is a sentence with blanks: "We sell ___ to ___-person ___ in ___, up
  against ___." Each blank fills as a member taps:
  - offering chips, from a short generic list plus Other;
  - a two-handle size slider;
  - trade chips, from a short generic list plus Other;
  - region toggles, from a short list plus Other;
  - rivals.
- **Typing.** Other and "+ add a rival" are the only places a person types.
- **Skip** is always visible and stores nothing.
- **Suggested rivals.** Once offering, trade and region are picked, the server asks the existing
  small model for up to five rival names. Each shows as a dashed "guess" chip with ✓ Right / ✗
  Wrong.
- **Filled.** The sentence is the title. Below it is one row per claim: its value, its id, its
  source ("you picked" or "suggested"), how often agents cited it ("cited 3× · last by think-big
  #746"), and ✓ / ✗.
- **Payoff card.** It says what the next think-big will cite and gives the line
  `omni business show` to try.

**Products.** While there is one product, nothing mentions products. "+ Add a product" (a name)
turns the page into one tab per product, each with its own sentence and picks. The region stays
shared above the tabs. From then on, Settings › Repositories shows a product select on each row.

**The read.** `omni business show` prints the confirmed claims for the repository it runs in: the
sentence, then one line per claim with its id. `--json` prints `{ state, business, product, claims }`,
the shape the later MCP link will return. It reads through a new bearer route,
`GET /api/business?repo=`.

It never blocks an agent. Each of these prints one line and exits 0, with `state` saying which in
`--json`:
- no business;
- a repository whose product has no confirmed claims;
- no sign-in;
- the app unreachable;
- a refusal.

**The citation log.** `omni business cited <id>… --by <skill> --ref <text>` appends to a log through
`POST /api/business/citations`. The page shows the count on each claim. Any failure prints a skip
line and exits 0.

**think-big.**
- Step 2, Fuel, gains one bullet: the confirmed claims, read with `omni business show --json`, go
  into the fuel sheet under their ids.
- Step 6, Record, lists in `concept.md`'s Fuel section the claim ids the studio cited, then runs
  `omni business cited`.

## Decisions

Settled with the person during the brainstorm:

1. **One business per workspace, several products.** A repository that serves another product (for
   example `vertuo-omni-loop` in the Vertuoza workspace) is assigned to its own product, so its
   agents read that product's claims and not the ERP's.
2. **Claims are split between business and product.** `region` belongs to the business and is shared
   by every product. `offering`, `size`, `trade` and `rival` belong to a product. A product's sentence
   takes the region from its business.
3. **Any member of the workspace picks and confirms.** Writes are not owner-only.
4. **Rivals are suggested, never catalogued.** The suggestion comes from the existing
   OpenRouter/Haiku call (`apps/galaxy/src/ask/classify.ts`'s shape), given the offering, trade and
   region. It is `proposed` until someone taps ✓. When the model key is unset or the call fails,
   there are no guesses and only "+ add a rival", never an error. Nothing names a competitor in the
   code.
5. **The one-liner is the generated sentence,** not a separate typed field.
6. **The citation log lives in the app,** as an append-only table. Its count shows on the page.
7. **The approach:** Supabase tables with RLS by `is_member`. Writes go only through
   security-definer RPCs, the pattern of Settings › Repositories (`20261008090000_repositories.sql`),
   with refusals `42501` (not a member), `P0002` (gone) and `22023` (invalid, with a `hint`).

Made in this spec, recorded here:

8. **States.** `proposed | confirmed | rejected | contradicted | unknown`.
   - A person's pick is `confirmed` at once.
   - ✗ Wrong sets `rejected`, and the row is kept, so a later draft never proposes it again.
   - `contradicted` and `unknown` exist for the later areas; nothing in this PRD sets them.
9. **Sources.** `pick | suggestion | evidence | answer`. This PRD writes `pick` and `suggestion`.
10. **Size** is stored as one claim whose value is `<min>-<max>`, on a slider of stops 1, 2, 5, 10,
    20, 50, 100, 250, 500, 1000+.
11. **The pick lists are generic and short, and live in the page's code,** not in the database. No
    list names a company.
    - Offering: ERP, CRM, marketplace, developer tool, analytics, e-commerce, Other.
    - Trade: construction, retail, healthcare, finance, logistics, manufacturing, software, Other.
    - Region: Belgium, France, Netherlands, Germany, United Kingdom, Europe, North America,
      Worldwide, Other.
12. **Repositories get their product.** Creating the business points every tracked repository at
    the first product. A repository tracked later points at the first product too. A repository with
    no product reads the business's claims only.
13. **The CLI's exit codes.** 0 for every reading outcome, 2 only for a usage or configuration
    error, so that a skill line calling it can never stop a run.
14. **`--json` is the contract** that the later MCP link (area `agent-connect`) returns unchanged:
    `{ "state": "ok" | "none" | "no-sign-in" | "unreachable" | "refused", "business": { "name" } | null, "product": { "name" } | null, "claims": [ { "id", "kind", "value", "source", "receipt", "lastSeen" } ] }`.
    `product` is null while the business has one product. `none` means no business, or no
    confirmed claim for this repository.
15. **Only confirmed claims leave the app.** Proposed and rejected claims are never returned by
    `GET /api/business`.

## User stories

1. As a member of a new workspace, I open Settings › Business and tap four or five choices. The
   sentence writes itself, and I never type unless my answer is not in a list.
2. As that member, I see up to five suggested rivals for my trade and region, and I confirm the real
   ones with one tap each.
3. As a member who is not ready, I press Skip and nothing is stored. Agents carry on as today.
4. As a member of a workspace whose repositories serve two products, I add a second product. I give
   each its own picks, and I assign each repository to its product on Settings › Repositories.
5. As an agent running `/omni:think-big`, I read the confirmed claims with their ids. I cite them in
   the fuel sheet and the concept, and I log the ids I cited.
6. As an agent in a workspace with no business, or with no sign-in, I read one line saying so, and
   I carry on.
7. As a member, I see on each claim how often agents cited it and which run did so last.

## Scope

**In:**
- the tables, RPCs, RLS and the SQL check;
- the Settings › Business page (empty, picking, suggested rivals, filled, products, payoff card,
  demo mode, 393px);
- the product select on Settings › Repositories;
- `GET /api/business` and `POST /api/business/citations`;
- the rival-suggestion server route;
- `omni business show [--json]` and `omni business cited`;
- think-big's Fuel bullet and Record step;
- the help entries.

**Out** (later areas of concept #746, or later PRDs):
- evidence drafting by `/omni:invade`, the pricing-page URL, and the "That's us" reveal
  (`evidence-draft`);
- contradiction diffs, last-seen fading, and the Monday digest (`evidence-draft`);
- `/omni:brainstorm` reading the claims, the customer's voice, and gap questions
  (`customer-voice`);
- Never lines and the phase-0 canon check (`canon-check`);
- the MCP link and tokens (`agent-connect`);
- deck upload;
- more than one business per workspace;
- strategy bets.

## Test seams

Tests follow `omni kb show testing`: beside the code, run by `pnpm test`, and never calling GitHub
or Supabase.

- **SQL** (`supabase/checks/business.sql`, plain SQL with `raise exception 'FAIL: …'`, as in
  `supabase/checks/repositories.sql`):
  - a member opens the business, picks, suggests, confirms and rejects;
  - a member of another workspace and a signed-out caller are refused (`42501`);
  - a bad kind or value is refused (`22023`);
  - `business_for_repo` returns confirmed claims only, region from the business and the rest from
    the repository's product;
  - `claims_cite` appends, and the log cannot be updated or deleted.
  - It runs as its own step in `.github/workflows/supabase.yml`.
- **Galaxy units:**
  - `model.test.ts`: the sentence built from claims, the reducer, and "Product" hidden while there
    is one;
  - `store.test.ts`: the RPC calls and the refusal mapping;
  - `load.test.ts`;
  - `render.test.ts`: the empty, filled, two-product and demo states;
  - the API handlers with a fake database: 401 without a token, 403 on another workspace, `none`
    when there is no business, confirmed claims only;
  - the rival suggestion with a stubbed fetch: parsed names, and `null` on a failure or when the
    key is unset.
- **Galaxy nav:** the Settings path lists in `src/switch/switch.test.ts`,
  `src/switch/headers.test.ts` and `src/nav/sidebar.test.ts` gain Business.
- **Kit:** `kit/bin/business.test.mjs` runs `main(['business', …])` against the fake ask server
  (`kit/test/fake-ask-server.mjs` gains `/api/business` and `/api/business/citations`). It covers
  every `state`, exit 0 on each of them, exit 2 on a usage error, `--json`'s exact shape, and
  `cited`'s skip line.
- **Plugin:** `kit/test/plugin.test.mjs` checks the think-big Fuel bullet and the Record step's
  `omni business cited` line. The unknown-command guard requires `business` in `COMMAND_TABLE`
  before the skill names it.

## Risks

- **What a merge publishes** (`omni kb show releasing`):
  - The migration is applied to the production Supabase project by the Supabase workflow's deploy
    job.
  - The kit's `omni business` command reaches every install through the next `chore(release)`.
  - think-big's new lines reach every plugin user.
  - The galaxy page ships with the app.
- **Rollback:** revert the PR, then a follow-up migration drops `claim_citations`, `claims`,
  `products`, `businesses` and `repositories.product_id`. The kit command is removed by the same
  revert.
- **Suggested rivals can be wrong or invented,** because a small model guesses them. They stay
  `proposed` until a person taps ✓, and agents never read a proposed claim.
- **Cost:** one model call per suggestion request, only after the three picks it needs.
  Suggestions are off wherever `OPENROUTER_API_KEY` is unset.
- **Privacy:** claims are business facts, read only by members of the workspace. `business_for_repo`
  runs `repo_workspace(auth.uid(), repo)`, so a person reads a repository's business only in a
  workspace they belong to.
- **think-big's success test is not proven by CI.** It is owed after merge by a person: pick
  Vertuoza's business, then run a think-big on a Vertuoza repository and check it cites the ICP and
  a named rival.

## Acceptance criteria

1. On a workspace with no business, Settings › Business shows the empty sentence, the pick controls
   and Skip. Pressing Skip stores nothing.
2. A member's picks (offering, size, trade, region) are stored as `confirmed` claims with source
   `pick`. The sentence title reflects them at once.
3. With offering, trade and region picked and the model key set, up to five suggested rivals appear
   as `proposed` claims with source `suggestion`. ✓ confirms one and ✗ sets it `rejected`. With the
   key unset, no suggestion appears and "+ add a rival" still works.
4. A member of another workspace, or a signed-out caller, cannot read or write the business (the SQL
   check proves it).
5. While the business has one product, no text on Settings › Business or Settings › Repositories
   says "Product". After "+ Add a product", the page shows one tab per product, and Settings ›
   Repositories shows a product select per row.
6. `omni business show` in a repository whose product has confirmed claims prints the sentence and
   one line per claim with its id, and exits 0. `--json` prints exactly the shape of decision 14,
   with `state: "ok"`.
7. `omni business show` exits 0 with one "— agents carry on" line in each of these cases, and
   `--json` gives the matching `state`:
   - no business, or no confirmed claim for this repository (`none`);
   - no sign-in (`no-sign-in`);
   - the app unreachable (`unreachable`);
   - a refusal (`refused`).
8. `GET /api/business` never returns a `proposed` or `rejected` claim.
9. `omni business cited rival#4 --by think-big --ref 'concept #9'` appends one citation. Settings ›
   Business then shows "cited 1× · last by think-big" on that claim. A failed call prints a skip line
   and exits 0.
10. think-big's `SKILL.md` Fuel step reads `omni business show --json`, and its Record step names
    `omni business cited`. The plugin test checks both.
