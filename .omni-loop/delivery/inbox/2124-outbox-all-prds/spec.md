---
prd: 2124
title: Every open question in one Outbox, repository PRDs included
blocked-by: none
spec: file
phase0: server
---

# Every open question in one Outbox, repository PRDs included

**Date:** 2026-10-16 · **PRD:** #2124 · **From:** PRD 2011 (#2011), its settled item s14-02, which the
person answered "a follow-up PRD" · **Touches:** `apps/galaxy/src/outbox-items/` (the Outbox's read
and page), `apps/galaxy/app/ask/(shell)/outbox/`, and the user guide.

## Problem

PRD 2011 gave Work › Questions an Outbox tab so that every open question across products sits in one
place. It lists only product PRDs' questions, read from `outbox_items`. A repository PRD, which is
every PRD of a repository that is not at step 5 of the rollout ladder (this one's included), keeps
its outbox in git and on its feature pull request, so its questions are missing from the list. A
person working across products still has to open each repository PRD to find what waits on them.

The data already exists on the server: `prd_outbox` (PRD 657) stores, for each PRD of a workspace's
repositories, the open items that wait on a person (ranked human-action or high, while the feature PR
is open), each as `{id, rank, question}`. The stages sync fills it every 15 minutes, and a stage event
or a Send recounts its one PRD. The waiting list (`/api/waiting/outbox`) already reads it.

## Solution

The Outbox tab (`/ask/outbox`) lists one merged list from two reads, both as the signed-in person:

- **Product PRDs:** `outbox_items`, open rows, as today.
- **Repository PRDs:** `prd_outbox.waiting` of every PRD in the viewer's workspaces, each item shown
  with its repository PRD's number, its repository and that repository's product.

Every row shows the same columns: the question, who it waits on (`waits on you` first), the product,
the PRD id (`mobile-12` or `912`) and the rank. The order is the viewer's first, then by rank, worst
first. The product filter of PRD 2011 (All, each product, No product) applies to both sources.

**Answering stays where each question lives.** A product PRD's question is answered in place, as
today. A repository PRD's row is a link to its PRD page's Outbox tab (`/prd/<id>?tab=outbox`), whose
existing Send flow answers it on the pull request. No new way to answer is added.

**Freshness is shown.** A repository row says `as of <time>`, its `prd_outbox.synced_at`, since it can
lag up to 15 minutes behind an answer typed on GitHub. A product row needs none: it is read live.

**What is not listed:** a repository PRD's medium items, which are adopted as raised and wait on
nobody, the same rule the waiting list follows.

## Decisions

- **One merged list, two reads** (the person): no new table and no sync; `prd_outbox` is read as it is.
- **A repository question is answered on its PRD page** (the person, over answering in place in the
  list): the existing Send flow stays the one way to answer on a pull request.
- **The voice's objection** (persona:Lead Engineer, at the design): "If a repository question shows
  up to 15 minutes after it was answered on GitHub, I'll answer it twice." Settled **accepted**: the
  PRD page reads GitHub live, so an answered item shows answered there; each repository row shows its
  `as of` time.
- **Mediums are not listed** (taken without asking, the waiting list's own rule).

## User stories

- As **Paul**, working on several products, I open Work › Questions › Outbox and see every question
  waiting on me, product PRDs and repository PRDs together, and filter by product.
- As the **Lead Engineer**, I see when a repository question was last read, so a stale row does not
  fool me.

## Scope

In:

- The repository read of `prd_outbox.waiting` in the Outbox's repository and service, merged and
  sorted with the product rows, filtered by product.
- A repository row's link to its PRD page's Outbox tab, and its `as of` time.
- The user guide's Questions section.

Out:

- Answering a repository question in the list itself.
- Listing medium items.
- Changing how or when `prd_outbox` is synced.

## Test seams

Per `omni kb show testing`: tests beside the code, no test calls GitHub or Supabase.

- **Repository:** the read of `prd_outbox` for the viewer's workspaces, with realistic rows (two
  workspaces, a PRD with no waiting item, a PRD whose feature PR closed).
- **Service:** the merge and order of both sources, the product filter across both, the viewer's rows
  first.
- **Page render:** a mixed list, a repository row's link and `as of` time, the empty state.

## Risks

Per `omni kb show releasing`, a merge to `main` publishes the arcade (`apps/galaxy`). No migration, no
kit change, no App change.

- **The arcade:** one more read per page view, of a table the waiting list already reads per
  workspace. Rollback: revert the PR.
- **Staleness:** a repository row can lag up to 15 minutes; the `as of` time says so, and the PRD
  page it links to reads GitHub live.

The locked laws: none touched. The design adds a read and a link; it adds no way to answer, so
BR-PRODUCT-12 and BR-PRODUCT-94 stay as they are.

## Acceptance criteria

1. With a product PRD holding one open item and a repository PRD of the same workspace holding one
   high item that waits on the viewer, `/ask/outbox` lists both, the viewer's first, each with its
   product, PRD id and rank.
2. A repository row links to `/prd/<id>?tab=outbox` of its PRD and shows `as of <time>` from
   `prd_outbox.synced_at`; a product row shows no `as of`.
3. The product filter set to one product lists only that product's rows from both sources; "No
   product" lists the rows of PRDs whose repository is in no product.
4. A repository PRD's medium item, and the items of a PRD whose feature PR is closed, are not listed.
5. A viewer sees no row of a workspace they are not a member of.
6. Answering a product PRD's question in the list works exactly as before this PRD.
