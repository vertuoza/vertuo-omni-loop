---
prd: 1258
title: Members vote on their own private ideas board
blocked-by: none
spec: file
---

# Members vote on their own private ideas board

**Date:** 2026-10-08 · **PRD:** #1258 · **Bug:** #1257 · **Touches:** `supabase/migrations/` (one new
migration: `idea_votable()` redefined), `supabase/checks/ideas.sql` (the vote rules),
`docs/guide/ideas.md` (who votes).
**Out of scope:** any change to the board page, the ▲ button, the voter's sign-in, `ideas_board()`,
`omni idea`, or who reads a private board.

## Problem

PRD 1246 shipped the ideas board with a rule that only a public board takes votes: the `idea_votes`
policies call `idea_votable()`, which is true only for an idea of a public board that is not
archived. A member of the workspace still reads their own board while it is private, ▲ included,
so every press there is refused, and the card says "Your vote could not be counted. Try again."
(#1257). Trying again never helps. A team that fills its board before turning it public cannot vote
on its own ideas.

## Solution

**A member votes on their own private board.** One new migration redefines `idea_votable(p_idea)`:
an idea takes or loses a vote when it is not archived and either its board is public or the caller is
a member of the idea's workspace (`public.is_member`). The insert and delete policies on
`idea_votes` already call it, so neither they, the tables nor the grants change.

**Who votes, after.**

| who | public board | private board |
|---|---|---|
| anyone, signed out | — (▲ asks for a sign-in) | — (reads nothing) |
| anyone signed in with GitHub | ✓ one vote per idea | — (reads nothing) |
| a member of the workspace | ✓ | ✓ one vote per idea, taken back by pressing ▲ again |

**Votes cast while private stay counted** once the board goes public: they are the same rows, one per
(idea, account). Turning a board private again keeps every vote, as today.

**The page does not change.** A member's ▲ already writes and deletes their own vote, and
`ideas_board()` already answers their votes and whether they voted. Every other refusal still shows
"Your vote could not be counted. Try again."

**The guide** (`docs/guide/ideas.md`) says a member votes on their board while it is private, and that
those votes stay counted when it goes public.

## Decisions

- **A rule change, not a bug fix.** #1257 found the ▲ refused on a private board; the person chose to
  let members vote there rather than hide the ▲, which changes PRD 1246's settled rule, hence this PRD.
- **Redefine `idea_votable()` only.** One function both policies share; the smallest change, and the
  rollback is the old body.
- **Keep private votes when the board goes public.** The voice objected (persona:Lead Engineer): once
  the board is public, the team's own votes are already in the count, so outsiders cannot tell what
  customers want from what the team pushed. The person kept the votes: one row per person, and lanes,
  not counts, set the order (PRD 1246). Settled: none.
- **No proof video.** The database checks are the proof.

## User stories

- As a member, I vote for the ideas on my workspace's private board, and take a vote back, before I
  turn the board public.
- As a member, I turn the board public and the votes my team cast are still counted.
- As someone outside the workspace, I still cannot read or vote on a private board.

## Scope

In: the migration redefining `idea_votable()`, the vote checks in `supabase/checks/ideas.sql`, and the
guide's who-votes table and Vote section.

Out: the board page and its ▲, the voter's sign-in, `ideas_board()`, `omni idea`, the read policies,
and any separate count of members' votes.

## Test seams

Following `omni kb show testing`: no test calls Supabase; the rules are proven by
`supabase/checks/ideas.sql`, a persistence check on realistic rows run against a local database, each
failure a `FAIL:` line.

- A member votes on an idea of their private board, and takes it back: both succeed, and
  `ideas_board()` answers the count and `voted` for them.
- A member's second vote on the same idea is still refused (one per idea, account).
- A member's vote on an archived idea of their private board is still refused.
- A signed-in person in no workspace is still refused on a private board (the existing case).
- A member's vote cast while private is still counted by `ideas_board()` once the board is public.

## Risks

Merging publishes, per `omni kb show releasing`:

- **The database:** the migration is applied to production Supabase. It only replaces the body of
  `idea_votable()`. Rollback: a migration restoring the old body (public board and not archived);
  votes cast meanwhile stay, and still count.
- **A policy mistake** could let someone outside the workspace vote on a private board. Guarded by the
  non-member case in the checks, and by that person reading no idea id of a private board.

## Acceptance criteria

- A member of the workspace presses ▲ on an idea of their private board and the count goes up by one;
  a second press takes the vote back and the count goes down by one.
- A member still cannot count two votes on one idea, nor vote on an archived idea.
- A signed-in person outside the workspace still cannot vote on an idea of a private board.
- After a member turns the board public, the votes cast while it was private are still counted.
- `docs/guide/ideas.md` says members vote on their board while it is private.
