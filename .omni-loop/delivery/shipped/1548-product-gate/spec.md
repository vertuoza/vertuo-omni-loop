---
prd: 1548
title: One gate, no plan PR
blocked-by: none
spec: file
phase0: server
---

# One gate, no plan PR

**Date:** 2026-10-11 · **PRD:** #1548 · **From:** concept #1269, area `product-gate`, after PRDs
#1299, #1322 and #1364 · **Touches:** `supabase/migrations/` (product PRD ids, outbox items and
settlements), `kit/` (product PRD ids, `omni dossier get`, the outbox store seam, the typed outbox
verbs, `omni prd --show`), `apps/omni-app` (the `omni/approved` check, the outbox check on a
product PRD, the server-event route), `apps/galaxy` (answering on the Questions tab, the attestation,
sending server events), `kit/plugin/skills/mega-*` and `ultra-*`, and the docs.

## Problem

A multi-repository PRD still needs a plan repository, a repository kept only to hold the loop's
state. It holds the PRD's issue and folder, the docs-only phase-0 PR, the plan PR that is the one
outbox gate, the outbox items relayed from every target, and the "Part of" links the targets' feature
PRs point at. Every one of those is a GitHub issue, a PR, a CI run on Markdown, or App calls, and the
App's quota is being hit (concept #1269).

What the three PRDs before this one left open:

- #1299 put phase 0 on the server for a one-repository PRD, but left "the `omni/approved` check on
  target feature PRs and the multi-repository skills" to this area.
- #1322 shipped the handshake (`omni wait approval`, the push, the void on a pinned-file push), but
  only `/omni:yolo`, `/omni:brainstorm` and `/omni:drive` use it. No mega or ultra skill knows
  `phase0: server`.
- #1364 made products hold their repositories (`product_repositories`, `plan: { product }`,
  `omni targets` read from the server), but its settled item `s4-01-other-readers-see-no-targets`
  records that `board`, `next`, `care`, `flow`, `roadmap`, bug fixes, knowledge copies and the
  retro still read `plan.targets[]` only. Its Questions tab only links to where questions are
  answered today: a comment on the plan PR.

The outbox exists only in git: an item is a file in `.omni-loop/delivery/outbox/<prd>-<topic>/`, a
settlement is a block in `settled.md`, and every answer, from the page or the terminal, ends as a
PR comment that `omni replies` reads back. A target feature PR's outbox check posts `success`
pointing at the plan PR (`checkTarget`, `planPrOf`, issue 1202). Nothing on a target PR says whether
what it builds was approved.

## Solution

A multi-repository PRD lives on its **product**, on the server, and no repository holds it.

**A product PRD** (◆) has an id made of the product's key and a counter, `mobile-12`. It is a
dossier with no home repository and no GitHub issue. Its spec, plan, before/after and voice are the
dossier's versions, and its outbox items, answers and settlements are rows on the server. Its code
still lands on GitHub, as one feature PR per target repository, each saying `Part of mobile-12` with
the PRD page's link.

**Typed verbs** read and write it, never a folder:

- `omni dossier get <id> <kind>` writes the latest version of one file to a scratch path and prints
  that path and its hash. `omni dossier push <id>` saves edited files as new versions.
  `omni dossier push --product <key> --new` creates the PRD and prints its id.
- `omni item new | adopt | settle | relay --prd mobile-12` write outbox rows. `omni status mobile-12`
  is the outbox gate, read from them. `omni answers` works on them too.
- `omni prd mobile-12 --show <kind>` prints the latest version, read-only, with `as of <time>`.

**One gate, two checks** on every target feature PR of a product PRD:

- **`omni/approved`**, new: `building` (every pinned hash matches the dossier's latest versions),
  `held` (the server cannot be read: held, not failed) or `drifted` (`≠ plan.md in <commit> ·
  content` or `· whitespace only`). Its Details link opens the attestation on the PRD page: who
  approved and when, a member of the workspace and an approver of the product, and the pinned
  hashes beside today's.
- **The outbox check**, keeping its name: `0 open · one gate on Mobile`, or `3 open · answer on
  Mobile › Questions`, read from the product PRD's outbox rows.

The GitHub App posts both when a webhook says the target PR opened or moved, and when the server
says an approval, a void, an item or a settlement changed the PRD. It never polls.

**Answers on the Questions tab.** The product's Questions tab lists every open outbox question of
the product's PRDs, with its PRD, its repository and who it is for, and its options as buttons. An
answer settles the item on the server; the next ultra wave reads it. Nothing is posted to GitHub.

**The multi-repository skills run from a product**: from any checkout of a repository the product
holds that has the kit installed, with `--product <key>`, which the checkout remembers. There is no
plan repository, no phase-0 PR and no plan PR for a product PRD.

## Decisions

- **One PRD, three landings** (asked): the check, the outbox on the server, the skills from a
  product. "No plan PR" holds only once all three land.
- **The outbox follows the birthplace** (asked): a product PRD's items and answers are server rows;
  a ◇ PRD, and a one-repository ◆ PRD, keep today's git files and PR-comment answers, unchanged.
- **The server is the PRD's home** (asked, in place of a lead repository): no PRD issue, no folder in
  any repository, and the skills get and save every file through `omni` verbs.
- **Product key + counter** (asked): `mobile-12`. The key is set once on the product; the counter is
  per product. It never looks like a GitHub number, so `omni prd 12` in a target stays that
  repository's own issue.
- **Run from any kitted product repository** (asked), with `--product <key>`. A product with no
  kitted repository is told to install the kit in one.
- **App-posted checks, webhook-first** (asked, among three): a GitHub Action in each target would
  cost a CI run on every push and a secret in every target; a status the kit sets at push comes from
  the agent's own machine and is no proof.
- **The voice objected**, persona:B-E DEv: "The spec and plan I build from now live in no repository
  I can grep. When the server is down I can't even read what I'm building." Settled `accepted`:
  `omni prd <id> --show <kind>` prints a read-only copy, and a last-read cache in `.omni-loop/local/`
  answers while the server is down, marked `as of`. No gate ever trusts it: building stops on `held`.
- **Every target of a product PRD is `phase0: server`.** A target still on `pr` is refused at
  brainstorm, by name. Mixing a docked repository into a product PRD is left to later.
- **The outbox check keeps its name** (`ci.outboxContext`), so no branch-protection rule breaks.
  `omni/approved` is a new name, `ci.approvedContext`.
- **Plan repositories keep working.** A PRD already in a plan repository is ◇ for life and finishes
  there. Archiving the plan repository, and moving roadmaps, bug records and knowledge, belong to
  area `product-records`.
- **One parser.** An item on the server keeps its markdown body as written; the kit's one item
  parser and the outbox guard run before any write, so the rules for a file and a row are one set.
- **No proof video** (asked).

## User stories

- As a PM, I run `/omni:mega-brainstorm --product mobile "offline photo upload"` from my checkout of
  `vertuo-mobile`, and get PRD `mobile-12` on its page, waiting for approval, with no issue and no
  PR opened anywhere.
- As an approver of Mobile, I approve `mobile-12` on its page, and each target feature PR shows
  `✓ omni/approved — building · 5 of 5 pinned`.
- As a PM, I answer the outbox questions of every repository on Mobile › Questions, and the outbox
  check on each target PR turns green when the last one is settled.
- As a developer reviewing `vertuo-api#446`, I open the `omni/approved` Details and see who approved
  what, and whether today's files still match.
- As the agent running `/omni:ultra-yolo mobile-12`, I take each target's plan from the server,
  relay my items there, and park on `held` rather than build on a copy I cannot verify.
- As a back-end developer, I read the spec in my terminal with `omni prd mobile-12 --show spec`.

## Scope

In:

- Product keys (`products.key`), product PRD ids (`dossiers.product_seq`), and every RPC that finds
  a dossier (`dossier_push`, `dossier_approve`, approval requests, the stream) taking either key.
- `outbox_items` and append-only `outbox_settlements`, written only by RPCs, read by members of the
  PRD's workspace.
- `kit/lib/ids.ts` reading `<n>` or `<key>-<n>`; an `OutboxStore` seam with a `git` store (today's
  code, moved) and a `server` store, picked by the PRD's birthplace; `omni dossier get`,
  `omni dossier push --product --new`, `omni prd --show`; every outbox verb on the seam.
- `board`, `next`, `care`, `flow` and `omni prd` reading a product's targets through
  `kit/lib/product/targets.ts` when `plan.product` is set (1364's settled item s4-01).
- In `apps/omni-app`: the `omni/approved` check, the outbox check reading server rows on a product
  PRD's target PR, and a signed server-event route; in `apps/galaxy`: sending those events, the
  attestation view, and answering on the Questions tab.
- `/omni:mega-brainstorm`, `/omni:ultra-yolo`, `/omni:ultra-wave`, `/omni:ultra-yolo-fix`,
  `/omni:mega-drive` and `/omni:mega-pr-care` running from a product; `/omni:do-work --target`
  writing items through the server store.
- The docs: `docs/guide`, the apps' READMEs and each changed skill.

Out:

- Roadmaps, bug records with their Fixes table, knowledge packs and archiving the plan repository
  (`product-records`); `/omni:mega-bug-fix`, `/omni:mega-roadmap` and `/omni:mega-invade` stay on
  the plan repository until then.
- The Constellation tab (`constellation-tab`).
- A docked (`phase0: pr`) repository in a product PRD.
- Moving existing plan-repository PRDs, or any ◇ PRD's outbox, to the server.
- A standalone `omni` CLI with no repository.

## Test seams

Per `omni kb show testing`: tests sit beside the code, and never call GitHub or Supabase.

- **Ids:** `kit/lib/ids.test.ts`, valid and invalid `<n>` and `<key>-<n>`.
- **The outbox store:** one contract suite run against both stores, the `git` one on a fixture
  repository (`makeRepo()`), the `server` one on a fake of the RPCs, so the two cannot drift. Every
  existing outbox test keeps passing on the `git` store untouched.
- **The checks:** the pure state function from (approval in force, latest versions, reachability) to
  conclusion and line, unit-tested; then `approved-check` and the outbox check end to end against a
  stubbed GitHub (`apps/omni-app/src/outbox-check/end-to-end.test.ts`'s pattern), on both the webhook
  and the server-event path, with a deferred budget, and with a PR body naming no product PRD (no
  check posted).
- **Database:** pgTAP for the key check, a counter with no gaps under two concurrent creates, RLS,
  settlements append-only, and `outbox_settle` refusing a non-member or an item already settled.
- **Galaxy:** the Questions tab's answer, as a component test and a route test, inside the layers of
  ADR-0095 (client, controller, service, repository).
- **The skills:** a skill-text test beside `kit/test/brainstorm-concept.test.ts` for each changed skill, and one dry run through `main()` on a fixture: a product PRD
  created, approved on a fake server, two target PRs, a relayed item, an answer, the gate green.
- **Mutation:** `pnpm mutation:changed` on the changed core files (`kit/lib/outbox/`, `kit/lib/ids.ts`,
  `kit/lib/board.ts`, `kit/lib/config.ts`).

## Risks

Per `omni kb show releasing`, a merge to `main` publishes the database (migrations applied to
production), the kit (`kit/dist/omni.mjs` and the plugin), and the two apps.

- **The database:** every migration only adds (`products.key`, `dossiers.product_seq`, two new
  tables and their RPCs), and each has a down script that refuses while a product PRD exists.
  Rollback: drop the new RPCs and tables before any product PRD is created; after, keep them.
- **The kit:** the `git` store is today's code behind the seam, and ◇ and one-repository PRDs never
  reach the `server` store. A regression there would break every PRD's outbox; the contract suite
  and the unchanged outbox tests guard it. Rollback: revert the kit release.
- **The App:** `omni/approved` posts only on a PR whose body names a product PRD; a repository can
  turn it off by removing `ci.approvedContext`. A new required check could block merges if it
  misfires: it posts `neutral` on `held`, never `failure`.
- **GitHub quota:** new posts come from events only, debounced per PRD, at `background` priority in
  the installation's budget, and the server event lists target PRs from `pull_requests`, not from
  GitHub.
- **Trust:** the server record stays the only proof; the issue label stays display-only, and the
  `--show` cache is never read by a gate.

## Acceptance criteria

1. `omni dossier push --product mobile --new` creates a dossier with no home repository and prints
   `mobile-<n>`, the next number for Mobile; two creates at once get two different numbers, with no
   gap.
2. `omni prd 12` in a target repository still reads that repository's issue 12; `omni prd mobile-12`
   reads the product PRD; `omni prd mobile` and `omni prd 12-mobile` are refused by name.
3. `omni dossier get mobile-12 plan` writes the latest plan to a scratch path and prints the path and
   its sha256; `omni prd mobile-12 --show spec` prints the spec with `as of <time>`, and, with the
   server unreachable, the last-read copy marked `as of <earlier time>`.
4. `omni item new --prd mobile-12 …` with a malformed item is refused with the same message
   `omni check outbox` gives for the same file, and nothing is written; a well-formed one becomes a
   row, and `omni status mobile-12` counts it open.
5. For a ◇ PRD, and for a one-repository ◆ PRD, every outbox verb reads and writes the same files as
   before this PRD, and every existing outbox test passes unchanged.
6. On a target feature PR whose body says `Part of mobile-12`, the App posts `omni/approved`:
   `success · building · <k> of <k> pinned` when every pinned hash matches; `failure · drifted · ≠
   <file> in <commit> · content` (or `· whitespace only`) after a push changes a pinned file;
   `neutral · held · server unreachable since <time>` when the record cannot be read. Its Details
   link opens the PRD page's attestation.
7. On the same PR, the outbox check reads `success · 0 open · one gate on Mobile` with no open item,
   and `failure · <k> open · answer on Mobile › Questions` otherwise, never pointing at a plan PR.
8. Approving, voiding, opening an item or settling one re-posts both checks on every open target PR
   of that PRD within one debounce window, without listing PRs from GitHub; a PR body naming no
   product PRD gets neither check.
9. On Mobile › Questions, a workspace member sees each open question of Mobile's PRDs with its PRD,
   its repository and who it is for, picks an option or writes another answer, and the item shows
   `settled`; a non-member's answer is refused, and an item already settled cannot be settled again.
10. `/omni:mega-brainstorm --product mobile` refuses a target on `phase0: pr` with
    `<repo> is phase0: pr · switch it to server on its Omni page, or leave it out`, and otherwise
    ends with a product PRD on its page, no issue, no phase-0 PR and no plan PR.
11. `/omni:ultra-yolo mobile-12` waits on approval, opens one feature PR per target saying
    `Part of mobile-12 · <page link>`, relays every item to the server, parks on `held` while the
    server is unreachable, refuses a slice while the PRD is drifted, and marks the target feature
    PRs ready once `omni status mobile-12` is green, without opening any PR in a plan repository.
12. `omni board`, `omni next`, `omni care` and `omni flow` list the product's targets when the
    config says `plan: { product }`.
