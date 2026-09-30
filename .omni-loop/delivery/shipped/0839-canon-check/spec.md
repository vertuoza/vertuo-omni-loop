---
prd: 839
title: The canon check
blocked-by: none
spec: file
---

# The canon check

**Date:** 2026-09-30 · **PRD:** #839 · **From:** concept #746, area `canon-check` (after PRDs 748,
774, 799 and 822)
**Touches:**
- `supabase/migrations/` (one new file), `supabase/checks/business.sql`
- `apps/galaxy/src/business/` (the Never lines list), `apps/galaxy/src/business/draft/` (proposing one)
- `apps/omni-app/src/inbox-check/` (the canon gate), `apps/omni-app/src/webhook/` (the two actions),
  a new `apps/omni-app/src/canon/`
- `kit/bin/commands/business.mjs`, `kit/bin/business.test.mjs`, `kit/dist/omni.mjs`

## Problem

The business store knows who the product is for, and the personas now speak up while a design is
brainstormed (PRD 822). But nothing holds the line once the spec is written. A spec edited by hand
after the brainstorm, or written by someone who skipped the voice, can design for "the CFO of a
six-entity holding" and reach a phase-0 PR for a product sold to five-plumber companies. The review
catches it only if the reviewer remembers the ICP.

The team also has lines it never crosses ("Never: build for groups of companies"), and they live
nowhere an agent or a check can read.

## Solution

**Never lines.** Claims gain a sixth kind, `never`, which belongs to a product. The value is the line
itself, at most 200 characters.
- On Settings › Business, a **Never lines** list sits under the claims, with **+ Never line**. A typed
  line is `confirmed` at once, like a pick, and each line has ✓ / ✗ like any claim.
- The draft and the weekly recheck (PRD 774) may **propose** one, with its receipt, when a source says
  what the product does not do.
- Agents read them through `omni business show` as `never#<seq>`, like every other claim.

**The canon gate.** The omni-loop App's inbox check (PRD 675) gains a fifth gate, **canon**, on
phase-0 PRs:
1. It reads the PR's `spec.md`, and the business of the PRD's repository through a new service-role
   read: that product's confirmed claims (with Never lines) and its personas.
2. It asks the small model (OpenRouter) whether the spec breaks a Never line, or designs for a
   customer outside the size, trade or region claims. Each finding must quote the spec and cite claim
   ids.
3. **A finding is kept only when its quote appears word for word in the spec** (whitespace and case
   aside), as in PRD 774. An invented breach is dropped.

The verdict:
- **red**, titled "canon ✗ N": its summary lists each break (the claim, the quoted spec line, and one
  line from the persona it fits worst);
- **green**, "canon ✓ · N claims read";
- **neutral**, never red, with one line saying why: no business, no confirmed claim for the
  repository's product, no model key, or a model error. The gate never fails a PR on its own failure.

**Two actions on a red canon check** (GitHub check-run buttons):
- **Rewrite for <persona>**: the App posts one comment on the PR, "To rewrite the spec for
  <persona>, run `/omni:brainstorm --rework <n>`" (PRD 822's rework). The rework's commit re-runs the
  check.
- **Change the claim**: the App posts one comment linking to Settings › Business at that claim. There a
  member changes it: a new wording is saved as a `proposed` claim and confirmed like any other. The
  check's Re-run, or the next push, grades the spec again.

A second click of the same action edits the same comment, never a new one.

## Decisions

Settled with the person during the brainstorm:

1. **The canon check is the App's inbox check's fifth gate,** so it holds for every phase-0 PR,
   including one whose spec was edited by hand.
2. **A red canon check offers two buttons,** Rewrite for <persona> and Change the claim, each posting
   one comment: the rework command, or the link to the claim.
3. **Never lines are a claim kind, per product,** typed on Settings › Business (confirmed at once) or
   proposed by the draft and the recheck.
4. **The Game-mode VS card is out** of this PRD.

Made in this spec, recorded here:

5. **Findings are kept only with a word-for-word quote from the spec,** as PRD 774 does for receipts.
6. **The gate is neutral, never red, when it cannot judge** (no business, no product claims, no key,
   a model error), so a missing setting never blocks a PR.
7. **The App reads the business with the service role, by repository,** through a new read that
   returns confirmed claims and personas only, like `business_for_repo`.
8. **The canon gate grades `spec.md` only,** not the plan or the before/after: the spec is where the
   customer is named.
9. **One model call per evaluation,** with the spec capped at 40,000 characters. The gate caches its
   verdict by the spec's hash and the claims' latest update, so a re-run with nothing changed
   costs nothing.

## User stories

1. As a member, I add "Never: build for groups of companies" on Settings › Business in one line, and
   every agent reads it.
2. As a reviewer of a phase-0 PR, I see "canon ✗ 1" with the spec's own words, the Never line it
   breaks, and Marc's one-line objection.
3. As the PRD's author, I press Rewrite for Marc and get the one command that reworks the spec; the
   next commit turns the check green.
4. As a member who thinks the claim is what's wrong, I press Change the claim and land on it on the
   Business page.
5. As a team with no business set up, I see the canon gate neutral with one line, and my PRs are not
   blocked.

## Scope

**In:**
- the `never` kind, its 200-character limit, its list on Settings › Business at 393px and in demo mode;
- the draft and recheck proposing `never` claims with receipts;
- the service-role business read by repository;
- the canon gate in the App's inbox check, with its verdicts and cache;
- the two check-run actions and their comments;
- `omni business show` printing `never#` lines;
- `OPENROUTER_API_KEY` read by the App.

**Out:**
- the Game-mode VS card;
- grading the plan or the before/after;
- a "ship anyway" override;
- concept PRs.

## Test seams

Tests follow `omni kb show testing`: beside the code, run by `pnpm test`, never calling GitHub,
Supabase or OpenRouter.

- **SQL** (`supabase/checks/business.sql`): a `never` pick is `confirmed`; a `never` evidence claim is
  `proposed`; over 200 characters is refused (`22023`); the service-role read returns confirmed claims
  and personas for a repository, never proposed or rejected claims, and nothing for a repository no
  workspace tracks.
- **Galaxy:** render tests for the Never lines list (empty, adding one, ✓ / ✗, 393px, demo); the draft's
  merge proposing a `never` claim with its receipt.
- **omni-app:** `evaluateInbox` with a stubbed model and business: green; red with quotes and persona
  line; a finding without a word-for-word quote dropped; neutral for no business, no product claims,
  no key and a model error; the cache skipping the model when nothing changed. The webhook handles
  both `requested_action`s and writes one comment each, editing it on a second click.
- **Kit:** `omni business show` prints `never#` lines; `--json` carries them as claims.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the migration goes to production through the
  Supabase workflow's deploy; the App's new gate goes live with omni-app's deploy; the page ships with
  galaxy; `omni business` changes reach every install through the next `chore(release)`.
- **The App's Inngest functions do not sync on deploy:** after omni-app deploys, a person presses
  Resync in Inngest, or the gate stays silent.
- **`OPENROUTER_API_KEY` must be set on omni-app's Vercel project;** until then the gate is neutral,
  "model not configured".
- **Migration order:** check the latest migration on `main` right before merging (the lesson of #771).
- **A model can invent a breach;** findings without a word-for-word quote are dropped, and the gate
  cites every claim it leans on.
- **Cost:** one call per changed spec per business version.
- **Rollback:** revert the PR, then a follow-up migration deletes `never` claims, removes the kind and
  drops the service read. The inbox check falls back to its four gates.
- **Not proven by CI:** a real phase-0 PR on a Vertuoza repository with Never lines, and the two
  buttons on GitHub. Owed after merge by a person.

## Acceptance criteria

1. On Settings › Business, + Never line adds a confirmed `never` claim; ✓ / ✗ work on it; a line over
   200 characters is refused.
2. A draft or recheck finding "we don't…" in a source proposes a `never` claim with its receipt.
3. `omni business show` prints `never#<seq>` lines, and `--json` returns them as claims.
4. On a phase-0 PR whose spec breaks a confirmed Never line, the inbox check's canon gate is red,
   titled "canon ✗ N", listing the claim, the spec's quoted line and one persona line.
5. A finding whose quote is not word for word in the spec never appears.
6. On a phase-0 PR that fits, the canon gate is green, "canon ✓ · N claims read".
7. With no business, no confirmed claim for the repository's product, no model key, or a model error,
   the canon gate is neutral with one line saying why.
8. Rewrite for <persona> posts one comment with `/omni:brainstorm --rework <n>`; Change the claim posts
   one comment linking to the claim on Settings › Business; a second click edits the same comment.
9. A re-run with an unchanged spec and unchanged claims does not call the model again.
