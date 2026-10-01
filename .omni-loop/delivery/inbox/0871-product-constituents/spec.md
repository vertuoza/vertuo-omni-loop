---
prd: 871
title: Product constituents
blocked-by: none
spec: file
proof: video
---

# Product constituents

**Date:** 2026-10-01 · **PRD:** #871 · **Next:** PRD B, a Jev decision `already-known` in the retro
(is the lesson already in the knowledge base), brainstormed after this one ships.
**Touches:**
- `supabase/migrations/` (one new file: `constituents`, `constituent_events`, the owner-only write
  functions, the read for the App and for the terminal, the one-time move of `never` claims, the
  widened `jev_decision_names()`), `supabase/checks/constituents.sql` (new)
- `apps/galaxy/src/business/` (a Constituents panel above the claims, its History drawer, the vague-word
  hint; the `never` kind leaves the claim editor), `apps/galaxy/src/constituents/` (new: model, store,
  load)
- `apps/galaxy/app/api/constituents/` (new: the terminal's read), `apps/galaxy/src/agent-connect/mcp/`
  (a `get_constituents` tool)
- `apps/galaxy/src/jev/decisions/` (a `constituent-break` entry, registered in `index.ts`)
- `apps/omni-app/src/canon/` (the gate reads constituents, and asks Jev through the decision when it is
  Shadow or On)
- `kit/bin/commands/constituents.mjs` and `kit/lib/constituents/` (new: fetch, cache, print),
  `kit/plugin/hooks/hooks.json` (a `SessionStart` hook), the help entry for `omni constituents`

## Problem

The coding agent does not know what the product it works on must never become. Today a product's
hard limits live as Never lines (PRD 839): business claims of kind `never`, which any member writes,
which the evidence draft may propose, and which only the brainstorm, think-big and yolo skills read.
Nothing reaches a session at boot, so `/omni:do-work`, `/omni:wave` and `/omni:bug-fix` build without
them. Nothing says what the product *is* in one statement either. And the store keeps no history:
who confirmed or rejected a line, and when, is lost, and a line cannot be removed, only rejected.

The inbox check's canon gate does judge specs against Never lines, but with one fixed model, which a
workspace that adopted Jev (PRD 812) cannot swap or compare.

## Solution

Each product gets its **constituents**: one **Statement** (what the product is) and a **Never list**
(what it must never become or do). They sit above every priority and the playbook.

1. **The store.** A `constituents` table (one Statement row per product, one row per Never line, each
   with its `never#<n>` id kept for life) and an append-only `constituent_events` log: who, what
   (`added`, `edited`, `removed`, `moved`), when, the text before and after. Rows are written only by
   security-definer functions that refuse anyone but a workspace owner (`is_owner`, PRD 400) and that
   write the event in the same transaction. A removal marks the row removed and logs it; no row is ever
   deleted, and a removed id is never reused.
2. **The move.** The migration moves each product's confirmed `never` claims into its Never list, in
   their order, each logged as `moved` with "moved from Business" and the claim's id, and the claim
   kept with state `rejected` so a revert can restore it. The `never` kind leaves the claim editor,
   `claim_pick` and `claim_propose_evidence`: the evidence draft and the recheck stop proposing Never
   lines.
3. **The panel.** Settings › Business shows, per product and above the claims, a Constituents panel:
   the Statement, the Never list, and a History drawer listing every event, newest first, with the
   person's chip, the date and time, and the before and after text. Owners see Edit, `+ Never line`
   and remove; members see the same panel read-only. While an owner types a Never line, a fixed list of
   vague words (`world-class`, `best`, `nice`, `quality`, `great`, `beautiful`, `modern`, `seamless`)
   shows a hint under the field ("names nothing a spec can break — say what it would look like"); it
   never blocks, and the Statement gets no hint.
4. **Boot sync.** The kit plugin's new `SessionStart` hook runs `omni constituents`, which reads the
   repository's product's constituents from the Omni page (`GET /api/constituents`, the terminal's
   sign-in), writes them to `.omni-loop/local/constituents.json`, and prints them, then the briefing
   follows. Offline or failing, it prints the cached copy with its age ("synced 3 d ago, offline");
   with no cache, no product or no sign-in, it prints one line saying so. It always exits 0, within a
   3-second budget. `omni constituents --json` prints the same for skills, and the MCP link gains a
   `get_constituents {repo?}` tool.
5. **The inbox judge.** A Jev decision `constituent-break` joins the registry (Off, Shadow, On,
   threshold and confidence floor, as PRD 812's three). The canon gate reads the constituents beside
   the claims and personas. Off: today's Haiku verdict, now also judging the Statement. Shadow: the
   Haiku verdict decides and Jev's is logged. On: Jev's verdict decides when its confidence is at or
   above the floor, otherwise Haiku's. A "broken" finding is kept only when its quote is in the spec
   word for word and it cites a live `never#<n>` or the Statement; then the check is red, names the
   spec sentence and the constituent, and carries the Rewrite and "Change the line" buttons (the latter
   links to `#never-<n>` on the panel). Red never blocks a merge: a person can still merge. The gate is
   neutral, never red, on its own failure (no Jev key, a Jev error, no constituents). The verdict cache
   key gains the latest constituent event id, so any change re-judges.

## Decisions

- **Scope:** constituents, history, boot sync and the Jev inbox judge in one PRD (the person widened
  it from three PRDs to two); the retro's `already-known` Jev check is PRD B.
- **Owners only** write constituents; members read them and their history.
- **Offline boot** prints the last synced copy with its age, never a committed file in the repository.
- **Broken is red but never blocks:** the check names the quote and the line, with the two buttons;
  a person can still merge.
- **Typed by an owner only:** existing confirmed `never` claims move into the list; nothing proposes
  Never lines any more.
- **Approach A,** an own store with an event log, over extending claims (claims are made to be
  proposed and rechecked, the opposite of strict) and over a committed file per repository (a product
  spans repositories, so copies would drift).
- **The voice's objection** (persona:B-E DEv, design round): "If Jev cries 'broken' on fluffy lines
  like 'world-class', I'll learn to merge past the red and the whole harness becomes noise."
  Settled `accepted`: a finding needs a word-for-word quote and a live constituent, and the editor
  hints when a Never line names nothing checkable.
- **No seed:** no workspace is filled with Vertuoza's constituents ([workspaces are generic]); the
  proposal below is for an owner to type after merge.
- **The ICP part** of the canon gate (size, trade, region claims) stays as it is.
- **Jev starts Off** in every workspace, so nothing changes until an owner switches it.

## User stories

1. As a workspace owner, I write my product's Statement and Never list on Settings › Business, so
   every agent that works on it knows its hard limits.
2. As a member, I read the constituents and their history, and see who added, edited or removed each
   line, and when.
3. As a coding agent starting a session in a repository, I read the product's constituents first,
   above the briefing, even offline.
4. As the person who merges phase-0 PRs, I see a red inbox check naming the spec sentence and the line
   it breaks, judged by Jev once my workspace turns the decision On.
5. As an owner typing "world-class components", I am told the line names nothing a spec can break.

## Scope

In: the two tables and their functions, the move of `never` claims, the panel and its History drawer,
the vague-word hint, `GET /api/constituents`, `omni constituents` and its `--json`, the kit
`SessionStart` hook, the MCP `get_constituents` tool, the `constituent-break` Jev decision and the
canon gate's use of it.

Out: the retro's `already-known` check (PRD B); members suggesting changes; AI-proposed lines; a
required check that blocks merges; an Always list; per-repository constituents (they are per product);
seeding any workspace.

## Test seams

- **SQL checks** (`supabase/checks/constituents.sql`): an owner adds, edits and removes; a member and
  an outsider are refused; every write leaves exactly one event with the right before and after; a
  removed line keeps its row and id, and the next line takes a new id; the move turns each confirmed
  `never` claim into a Never line with a `moved` event and leaves the claim `rejected`; `claim_pick`
  refuses kind `never`.
- **Galaxy unit and render tests:** the panel by role (owner sees the controls, member does not), the
  History drawer's order and fields, the vague-word hint shown and never blocking, the model's parse
  of the API body.
- **Kit unit tests** for `omni constituents`: fresh (prints and caches), offline with cache (prints
  the copy and its age), offline without cache, no product, no sign-in, a slow page past 3 seconds —
  each exits 0; `--json` shape.
- **Canon gate tests:** Off, Shadow (Haiku decides, Jev logged) and On (Jev decides above the floor,
  Haiku below it); a finding without a word-for-word quote or citing a removed line is dropped;
  neutral on a Jev error; the cache re-judges when an event is added.
- **Jev registry test:** `constituent-break` is registered and its name is accepted by
  `jev_decision_names()`.
- Follow `omni kb show testing`: no test calls a real model, the real Omni page or GitHub; ports are
  injected.

## Risks

- **Publishes** a migration (new tables, a changed `claim_pick` and `claim_propose_evidence`, the move
  of `never` claims), a new kit hook every installed repository gets on `omni update`, and a changed
  inbox check. The migration's date must be after the latest migration on main at merge time.
- **A slow boot:** the hook is capped at 3 seconds and always exits 0.
- **Noise in the inbox:** Jev starts Off; the quote rule drops unproven findings.
- **Rollback:** switch `constituent-break` Off; remove the hook from `hooks.json` in a kit release; the
  tables are additive, and the moved claims are kept `rejected`, so a follow-up migration can set them
  back to `confirmed`.

## Acceptance criteria

1. An owner adds a Statement and two Never lines for a product on Settings › Business; they show in
   the panel, and the History drawer lists three `added` events with the owner and the time.
2. An owner edits the Statement and removes `never#2`; the History shows the edit with its before and
   after, and the removal; a new line then gets `never#3`, not `never#2`.
3. A member opens the same panel and sees the Statement, the Never list and the History, with no
   Edit, add or remove control; writing through the API as a member is refused.
4. Typing "world-class components" as a Never line shows the vague-word hint, and the line can still
   be saved.
5. After the migration, every product's previously confirmed Never lines are in its Never list, each
   with a `moved` event, and the claim editor no longer offers the Never kind.
6. A new Claude session in a repository connected to that product prints the Statement and the Never
   list above the briefing; with the network off, it prints the last copy with "synced … ago" and the
   session starts normally.
7. With `constituent-break` Off, a phase-0 spec quoting `fetch('/api/v1/projects')` in a product whose
   Never list says it never calls real APIs gets a red inbox check naming that quote and `never#1`,
   with the Rewrite and "Change the line" buttons; a spec breaking nothing is green.
8. With `constituent-break` On and a Jev key set, the same red spec is judged by Jev and the decision's
   30-day record shows the call; with no key, the check is neutral, never red.

## First proposal for Vertuoza (for an owner to type after merge, never seeded)

**Vertuoza.** Statement: the all-in-one management software for small construction companies, from
quote to invoice and site to accounting, built for the people who run the trade. Never:
an ERP for an audience outside the construction ecosystem · needs a consultant to start · silently
changes a quote or invoice once sent · ships a site flow that cannot be finished on a phone · makes
the customer retype what Vertuoza already knows.

**Vertuoza UX.** Statement: the component workshop, serving world-class React components for
Vertuoza, shown with fixtures. Never: calls real Vertuoza data or real Vertuoza APIs (fixtures and
mocks only) · holds business logic (a component renders and emits; Vertuoza decides) · depends on a
Vertuoza backend package · ships a component that cannot be used from the keyboard.

**Omni Loop.** Statement: turns an idea into merged code through PRDs a person approves; agents
build, people decide. Never: merges into the default branch on its own · writes code before a person
approved the design · seeds a workspace with another company's setup.
