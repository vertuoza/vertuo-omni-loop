# Plan: the business store

PRD #748, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/business-store` into `main`, and the feature PR says `Closes #748`. Each slice is a sub-PR from
`feat/business-store--<slice>` into the feature branch, saying `Part of #748`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Covers the store and its read. It adds the business, product, claim and citation tables, `repositories.product_id`, and every RPC, with RLS by `is_member`, proven by `supabase/checks/business.sql` in CI. `GET /api/business?repo=` returns a repository's confirmed claims, and `omni business show [--json]` prints them, or one "agents carry on" line with exit 0 in every other state | `supabase/migrations/20261017090000_business_store.sql` `supabase/checks/business.sql` `.github/workflows/supabase.yml` `apps/galaxy/app/api/business/route.ts` `apps/galaxy/src/business-api/` `kit/bin/commands/business.mjs` `kit/bin/commands/index.mjs` `kit/bin/business.test.mjs` `kit/lib/ask/client.mjs` `kit/lib/help/entries.mjs` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | Adds the Settings › Business tab: the empty sentence with blanks, picks (offering, size slider, trade, region, "+ add a rival", Other) stored as confirmed claims, Skip, the filled sentence and its ✓ / ✗ rows with "cited N× · last by …", the payoff card, demo mode and the 393px layout | `apps/galaxy/app/app/settings/business/` `apps/galaxy/src/business/` `apps/galaxy/src/nav/` `apps/galaxy/src/switch/` `apps/galaxy/src/data/viewer-reads.test.ts` `apps/galaxy/src/fleets/render.test.ts` | s1 | 2 |
| s5 | Makes think-big read and log the business. `omni business cited <id>… --by --ref` appends through `POST /api/business/citations`, and any failure prints a skip line and exits 0. think-big's Fuel step reads `omni business show --json`, and its Record step lists the cited ids and runs `omni business cited`. The plugin test checks both | `apps/galaxy/app/api/business/citations/` `apps/galaxy/src/business-api/` `kit/bin/commands/business.mjs` `kit/bin/business.test.mjs` `kit/lib/ask/client.mjs` `kit/lib/help/entries.mjs` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` `kit/plugin/skills/think-big/` `kit/test/plugin.test.mjs` | s1 | 2 |
| s3 | Adds suggested rivals. Once offering, trade and region are picked, the page asks `POST /api/business/suggest-rivals`, which calls the OpenRouter small model. Up to five dashed "guess" chips appear as proposed claims with ✓ Right / ✗ Wrong. With no key or on a failure there are no guesses, and "+ add a rival" is unchanged | `apps/galaxy/app/api/business/suggest-rivals/` `apps/galaxy/src/business/` | s2 | 3 |
| s4 | Adds products. "+ Add a product" turns the page into one tab per product, each with its own sentence and picks, with the region shared above the tabs. Settings › Repositories shows a product select per row once there are two or more products, and "Product" appears nowhere while there is one | `apps/galaxy/src/business/` `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` | s2 | 4 |

**Shared ground.**
- **`apps/galaxy/src/business-api/`, `kit/bin/commands/business.mjs`, `kit/bin/business.test.mjs`,
  `kit/lib/ask/client.mjs`, `kit/lib/help/entries.mjs`, `kit/test/fake-ask-server.mjs` and
  `kit/dist/omni.mjs`:** s1 and s5. s5 is blocked by s1, which keeps them apart (wave 1, then wave 2).
  `kit/dist/omni.mjs` is rebuilt by each kit slice (`pnpm kit:build`), because
  `kit/test/dist.test.mjs` fails on a stale bundle.
- **`apps/galaxy/src/business/`:** s2, s3 and s4, in waves 2, 3 and 4. s3 and s4 both edit the page
  view and its render test, so s4 waits one wave behind s3 even though only s2 blocks it.
- **The database:** every table and RPC lands in s1's single migration, and s3 and s4 add no SQL.
  s4's product RPCs (`product_add`, `product_rename`, `repository_set_product`) are written and
  checked in s1, so no later slice touches `supabase/`.
- **The Settings path lists** in `apps/galaxy/src/switch/switch.test.ts`,
  `apps/galaxy/src/switch/headers.test.ts`, `apps/galaxy/src/nav/sidebar.test.ts`,
  `apps/galaxy/src/data/viewer-reads.test.ts` and `apps/galaxy/src/fleets/render.test.ts` are s2's
  alone.
- s2 and s5 share no prefix: `apps/galaxy/src/business/` does not cover
  `apps/galaxy/src/business-api/`.

## Per slice: done when

**s1: the store and its read**
- The migration creates `businesses` (one per workspace), `products`, `claims` and
  `claim_citations`, adds `repositories.product_id`, and grants explicitly
  (`auto_expose_new_tables = false`).
- The claim kinds, sources and states are exactly those of the spec. `seq` counts the business's
  claims whatever their kind.
- `supabase/checks/business.sql` passes as its own step in `.github/workflows/supabase.yml`, proving:
  - a member can `business_open`, `claim_pick`, `claim_set_state`, `product_add`, `product_rename`,
    `repository_set_product` and `claims_cite`;
  - another workspace's member and a signed-out caller get `42501`;
  - a bad kind or value gets `22023`;
  - `business_open` points every tracked repository at the first product;
  - `business_for_repo` returns confirmed claims only, with region from the business and the rest
    from the repository's product, and business claims only when the repository has no product;
  - `claim_citations` refuses updates and deletes.
- `GET /api/business?repo=` answers:
  - 401 without a token;
  - `none` when there is no business or no confirmed claim;
  - 403 for a repository outside the caller's workspaces;
  - otherwise the decision-14 body, never a proposed or rejected claim.

  A handler test with a fake database proves each case.
- `omni business show` prints the sentence and one line per claim with its id, and exits 0.
  - `--json` prints exactly the decision-14 shape.
  - With no business, no sign-in, the app unreachable or a refusal, it prints one "— agents carry
    on" line and exits 0, and `state` is `none`, `no-sign-in`, `unreachable` or `refused`.
  - A usage error exits 2.

  `kit/bin/business.test.mjs` proves each case against the fake ask server. The command is in
  `COMMAND_TABLE` and has a help entry, and `kit/dist/omni.mjs` is rebuilt.

**s2: the Settings › Business tab**
- Settings shows the tabs Fleets · Repositories · Business, and the trail reads
  `Settings › Business`. The switch, headers, sidebar, viewer-reads and fleets tests list the new
  path.
- On an empty workspace the page shows the sentence with blanks, the pick controls and Skip, and
  Skip stores nothing.
- Picking stores a `confirmed` claim with source `pick`, the title sentence updates at once, and
  Other and "+ add a rival" are the only text inputs.
- A filled page shows one row per claim with its id, source chip, "cited N× · last by …" and ✓ / ✗.
  ✗ sets `rejected`, and the row leaves the sentence.
- The payoff card lists the confirmed claims and the line `omni business show`.
- Demo mode shows sample rows. `model`, `store`, `load` and `render` tests cover the empty, filled
  and demo states, and a render at 393px has no row wider than the screen.

**s5: think-big reads and logs the business**
- `omni business cited rival#4 --by think-big --ref 'concept #9'` appends one citation through
  `POST /api/business/citations`, and a failed call prints a skip line and exits 0. The handler test
  proves 401, 403 and the append, and the kit test proves the skip line and exit 0.
- think-big's step 2 Fuel has the business bullet reading `omni business show --json`: confirmed
  claims go into the fuel sheet under their ids, and any other state is said in one line before the
  run carries on.
- think-big's step 6 Record lists the cited claim ids in `concept.md`'s Fuel section and runs
  `omni business cited`.
- `kit/test/plugin.test.mjs` checks both lines, and the unknown-command guard passes.

**s3: suggested rivals**
- With offering, trade and region picked and `OPENROUTER_API_KEY` set, the page shows up to five
  dashed "guess" chips. Each is stored as a `proposed` claim with source `suggestion`. ✓ confirms it
  and ✗ rejects it.
- A test with a stubbed fetch proves the parsed names, and `null` with no key, on a non-ok answer and
  on an unparseable reply. The page then shows no guess and no error.
- A rejected rival is not suggested again. No list in the code names a company.

**s4: products**
- While the business has one product, no text on Settings › Business or Settings › Repositories
  says "Product".
- "+ Add a product" (one name) creates a product. The page then shows one tab per product, each with
  its own sentence and picks, and the region shared above the tabs.
- With two or more products, each Settings › Repositories row has a product select that calls
  `repository_set_product`, and `omni business show` in that repository then reads its product's
  claims.
- Render tests cover one product, two products and the repositories select.
