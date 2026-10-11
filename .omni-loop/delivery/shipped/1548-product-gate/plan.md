# Plan: One gate, no plan PR

PRD #1548, spec `spec.md` beside this plan. The work lands in three stacked pull requests into `main`,
the three pieces the spec decided: the `omni/approved` check on product PRDs (approved-check), the
outbox on the server (outbox-server), and the multi-repository skills run from a product
(skills-from-product). Each landing's branch is `feat/product-gate-<n>of3-<name>`, and each PR body
opens with `Closes #1548`. Each slice is a sub-PR from `feat/product-gate--<slice>` into its
landing's branch, with `Part of #1548`.

Every migration only adds, and nothing reads a new table or column before its own landing: landing 1
adds the product PRD key, landing 2 the outbox tables, and landing 3 changes no schema.

## Slices

| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | A product has a key set once, and a product PRD is a dossier keyed by product and counter (`mobile-12`) with no home repository; `dossier_push`, `dossier_approve`, approval requests and the approval stream take either key | `supabase/migrations/` `supabase/checks/product_prd_ids.sql` `supabase/checks/dossiers.sql` `supabase/checks/approvals.sql` `supabase/checks/approval_requests.sql` `supabase/database.types.ts` | — | 1 | 1 |
| s2 | `omni dossier push --product <key> --new` creates a product PRD and prints its id, `omni dossier get <id> <kind>` writes the latest version to a scratch path with its hash, and `omni prd <id>` reads a product PRD, with `--show <kind>` printing it read-only, `as of`, from a last-read copy when the server is down | `kit/lib/ids` `kit/lib/dossier/` `kit/lib/approval/` `kit/bin/commands/dossier` `kit/bin/commands/prd` `kit/lib/help/entries.ts` `apps/galaxy/app/api/dossiers/push/` `apps/galaxy/app/api/dossiers/get/` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/store` | s1 | 2 | 1 |
| s3 | The App posts `omni/approved` (`ci.approvedContext`) on a target feature PR whose body names a product PRD, from its webhook: building, drifted or held, from the approval in force and the dossier's latest versions | `apps/omni-app/src/approved-check/` `apps/omni-app/src/webhook/` `apps/omni-app/src/functions.ts` `apps/omni-app/src/inngest-client.ts` `apps/galaxy/app/api/dossiers/approval/` `apps/galaxy/src/approval/` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/schema/config` | s1 | 2 | 1 |
| s4 | Approving or voiding a product PRD sends one signed server event, which re-posts `omni/approved` on that PRD's open target PRs read from `pull_requests`, and the check's Details opens the attestation on the PRD page | `apps/omni-app/src/server-event/` `apps/omni-app/src/functions.ts` `apps/omni-app/entries/` `apps/galaxy/src/server-event/` `apps/galaxy/src/approval/` `apps/galaxy/src/dossier/page/Attestation` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/layering/baseline.json` | s3 | 3 | 1 |
| s5 | `outbox_items` and append-only `outbox_settlements` exist for a product PRD, written only by `outbox_item_put`, `outbox_item_adopt` and `outbox_settle`, read by members of the PRD's workspace | `supabase/migrations/` `supabase/checks/outbox_items.sql` `supabase/database.types.ts` | — | 1 | 2 |
| s6 | Every outbox verb goes through one `OutboxStore`, whose `git` store is today's code moved, with a contract suite; nothing a ◇ or one-repository PRD does changes | `kit/lib/outbox/` `kit/bin/commands/item` `kit/bin/commands/adopt` `kit/bin/commands/settle` `kit/bin/commands/status` `kit/bin/commands/answers` `kit/bin/commands/replies` `kit/bin/commands/comment` | — | 1 | 2 |
| s7 | The `server` store writes and reads a product PRD's items and settlements through galaxy routes, picked by birthplace, so `omni item new`, `adopt`, `settle` and `relay`, `omni status` and `omni answers` work on `mobile-12`, refusing a malformed item before any write | `kit/lib/outbox/` `apps/galaxy/app/api/outbox/items/` `apps/galaxy/src/outbox-items/` | s5, s6 | 2 | 2 |
| s8 | The outbox check on a product PRD's target PR reads its rows (`0 open · one gate on Mobile`), and opening or settling an item re-posts both checks through the server event | `apps/omni-app/src/outbox-check/` `apps/omni-app/src/server-event/` `apps/galaxy/src/server-event/` | s7 | 3 | 2 |
| s9 | Mobile › Questions lists every open question of the product's PRDs with its PRD, repository and who it is for, and a member answers it there, settling it | `apps/galaxy/src/product-home/` `apps/galaxy/src/questions/` `apps/galaxy/app/api/outbox/answer/` `apps/galaxy/layering/baseline.json` | s7 | 3 | 2 |
| s10 | `omni board`, `omni next`, `omni care` and `omni flow` read a product's targets when the config says `plan: { product }` | `kit/bin/commands/board.ts` `kit/bin/commands/next.ts` `kit/bin/commands/care.ts` `kit/bin/commands/flow.ts` `kit/lib/board.ts` `kit/lib/product/targets` `kit/lib/plan-repo/targets` | — | 1 | 3 |
| s11 | `/omni:mega-brainstorm --product <key>` runs from any kitted checkout of a product repository, remembers the product, refuses a target on `phase0: pr` by name, and ends with a product PRD on its page, no issue and no PR | `kit/plugin/skills/mega-brainstorm/` `kit/lib/product/checkout` `kit/bin/commands/product` `kit/test/mega-brainstorm-product.test.ts` | — | 1 | 3 |
| s12 | `/omni:ultra-yolo`, `/omni:ultra-wave`, `/omni:ultra-yolo-fix`, `/omni:do-work --target`, `/omni:mega-drive` and `/omni:mega-pr-care` run a product PRD: wait on approval, open `Part of mobile-12` target PRs, take plans through `omni dossier get`, relay items to the server, park on held, refuse on drifted, and mark the targets ready on a green gate with no plan PR | `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo-fix/` `kit/plugin/skills/do-work/` `kit/plugin/skills/mega-drive/` `kit/plugin/skills/mega-pr-care/` `kit/test/product-dry-run.test.ts` | s10, s11 | 2 | 3 |
| s13 | The guide and the apps' READMEs describe product PRDs, the two checks, the Questions tab and running from a product | `docs/guide/products.md` `docs/guide/several-repositories.md` `docs/guide/index.md` `apps/galaxy/README.md` `apps/omni-app/README.md` | s12 | 3 | 3 |

**Shared ground.**

- `supabase/migrations/` and `supabase/database.types.ts`: s1 (landing 1) and s5 (landing 2), apart
  by landing. Each migration is dated after the newest one on `main` when its slice is built.
- `apps/omni-app/src/functions.ts`: s3 (wave 2) registers the approved check, s4 (wave 3) the server
  event.
- `apps/galaxy/src/approval/`: s3 (wave 2) reads the approval for the check, s4 (wave 3) sends the
  event from it.
- `apps/omni-app/src/server-event/` and `apps/galaxy/src/server-event/`: s4 creates them (landing 1),
  s8 adds the item events (landing 2).
- `kit/lib/outbox/`: s6 (wave 1) moves the code behind the store, s7 (wave 2) adds the server store.
- `apps/galaxy/layering/baseline.json`: s4 (landing 1) and s9 (landing 2), each removing the
  breaches of the files it rewrites.
- `kit/lib/help/entries.ts` is s2's alone; s11's `omni product` option goes in its own entry file
  under `kit/bin/commands/product`.
- The generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by each wave, never listed.

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | approved-check | — |
| 2 | outbox-server | landing 1 is deployed |
| 3 | skills-from-product | landing 2 is deployed |

## Per slice: done when

**s1**
- `products.key` is unique per workspace and cannot change once set; `dossiers.product_seq` with a
  CHECK that exactly one of `home_repo + prd` or `product + seq` holds.
- `supabase/checks/product_prd_ids.sql` proves two concurrent creates for Mobile get two numbers with
  no gap, and a key that is not lowercase kebab-case is refused.
- `dossier_push`, `dossier_approve`, `approval_request` and the stream find a product PRD by its key;
  every existing check in `dossiers.sql`, `approvals.sql` and `approval_requests.sql` still passes.
- The down script refuses while a product PRD exists.

**s2** (`ui: yes`)
- `kit/lib/ids.test.ts`: `12` and `mobile-12` read; `mobile`, `12-mobile` and `Mobile-12` are refused
  by name; `omni prd 12` in a repository still reads its issue 12 (acceptance 2).
- `omni dossier push --product mobile --new` prints `mobile-<n>` (acceptance 1).
- `omni dossier get mobile-12 plan` writes a scratch file and prints its path and sha256; `omni prd
  mobile-12 --show spec` prints it with `as of <time>`, and with the server faked down prints the
  last-read copy marked with its earlier time (acceptance 3).
- `omni prd mobile-12` prints `birthplace: server` and its `approval:` lines through `prdState()`.

**s3** (`ui: yes`)
- A pure function from (approval in force, latest versions, reachability) to (conclusion, line) is
  unit-tested for building, drifted (content and whitespace only) and held.
- Against a stubbed GitHub, a `pull_request` opened or synchronize on a PR whose body says
  `Part of mobile-12` posts `omni/approved` as acceptance 6 says, with Details on the PRD page; a body
  naming no product PRD gets no check (acceptance 8).
- `ci.approvedContext` reads from the config, default `omni/approved`, and a repository without it
  set to a name posts none.
- A call the budget defers is retried after its window, as the outbox check's is.

**s4** (`ui: yes`)
- Approving, and a push that voids an approval, each send one signed `POST` to omni-app; a bad
  signature is refused 401.
- The event re-posts `omni/approved` on every open target PR of that PRD from `pull_requests`, with
  no GitHub list call, debounced per PRD (acceptance 8).
- The PRD page's attestation shows the approver, member and approver ticks, the time, and each
  pinned hash beside today's, with restore and ask again when drifted.

**s5**
- `supabase/checks/outbox_items.sql`: an item row with its typed columns and body; a settlement
  appended, never updated or deleted; `outbox_settle` refused for a non-member and for an item
  already settled (acceptance 9); members of another workspace read nothing.

**s6**
- One contract suite runs against the `git` store on a fixture repository; every existing test in
  `kit/lib/outbox/` and of the moved commands passes unchanged (acceptance 5).
- No outbox verb reads or writes the filesystem except through the store.
- `pnpm mutation:changed --base origin/feat/product-gate-2of3-outbox-server` leaves no survivor in
  the code moved.

**s7** (`ui: yes`)
- The same contract suite runs against the `server` store on a fake of the routes.
- `omni item new --prd mobile-12` with a malformed item prints the message `omni check outbox` gives
  for the same file and writes nothing; a good one becomes a row and `omni status mobile-12` counts it
  open (acceptance 4).
- `omni adopt`, `omni settle`, `omni item relay` and `omni answers` work on `mobile-12`; with the
  server down each exits 1 with `held · server unreachable since <time> · held, not failed`.

**s8** (`ui: yes`)
- Against a stubbed GitHub, the outbox check on a `Part of mobile-12` PR reads `success · 0 open ·
  one gate on Mobile` or `failure · <k> open · answer on Mobile › Questions`, never pointing at a plan
  PR (acceptance 7).
- An item put or settled re-posts both checks through the server event (acceptance 8).
- A target PR of a plan-repository PRD still reads `success` pointing at its plan PR.

**s9** (`ui: yes`)
- Component and route tests: the tab lists each open question with its PRD, repository and who it is
  for, its options as buttons and an "other" answer; answering shows `settled` (acceptance 9).
- A non-member's answer is refused, and the layering of ADR-0095 holds.

**s10**
- With `plan: { product: mobile }` and a fake server, `omni board`, `omni next`, `omni care` and
  `omni flow` list Mobile's targets (acceptance 12); with `plan.targets[]` they read as before.

**s11**
- The skill text says the `--product` run, the remembered product, the `phase0: pr` refusal line of
  acceptance 10 and the hand-off to the PRD page; `kit/test/mega-brainstorm-product.test.ts` checks
  each of those lines.
- `omni product use <key>` remembers the product in `.omni-loop/local/`, and `omni product which`
  prints it.

**s12**
- Each skill's text names the product path, and `kit/test/product-dry-run.test.ts` runs through
  `main()` on a fixture: a product PRD created, approved on a fake server, two target PRs, a relayed
  item, an answer, the gate green, the targets marked ready, and no PR in a plan repository
  (acceptance 11).

**s13**
- `docs/guide/products.md` and `docs/guide/several-repositories.md` describe a product PRD from
  brainstorm to ready; the omni-app README names `omni/approved` and the server event; the galaxy
  README names the Questions tab answering and the attestation.
