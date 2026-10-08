---
prd: 1246
title: A public ideas board people can vote on
blocked-by: none
spec: file
proof: video
---

# A public ideas board people can vote on

**Date:** 2026-10-08 · **PRD:** #1246 · **Touches:** `supabase/migrations/` (one new migration:
`ideas`, `idea_votes`, a public flag per repository), `apps/galaxy/app/ideas/[owner]/[repo]/` (the
public board), `apps/galaxy/src/ideas/` (new: the board, its data and its member controls),
`apps/galaxy/src/nav/sidebar.ts` (Work › Ideas), `apps/galaxy/app/app/settings/repositories/` (the
public toggle), `apps/galaxy/app/auth/callback/route.ts` and `apps/galaxy/src/data/sign-in*.ts` (a
voter's sign-in), `kit/bin/commands/idea.ts` and `kit/lib/idea/` (new: `omni idea add`,
`omni idea list`), `docs/guide/ideas.md`.
**Out of scope:** comments, ideas proposed by the public, turning an idea into a PRD automatically,
notifications, and any page for a private board outside the workspace.

## Problem

Ideas for what to build next live in one person's head or chat. Today, for omni-loop:

- Improve the HUD with more useful information.
- Switch the token tracking from tokenspend to omni-loop, so the loop tracks its own spend.
- Training on P-R, importing from https://github.com/nicojustdev/lenny.
- A setting that lets the AI merge by itself, with an independent code review it cannot skip.
- Rework the UX of Product, Business and Settings.
- A better UX on the approval gate.
- A better sync with GitHub, to call the GitHub API less.
- A better score for the gamification.

omni-loop is open core with a hosted app (offering#316). The people who use it cannot see which ideas
are coming, and the team cannot see which ones those people care about. The Omni page has no place for
an idea before it becomes a PRD (a draft dossier is a brainstorm already started), and every workspace
page is for signed-in members only: only `/docs`, `/releases` and `/signup` are public.

## Solution

**A board per repository, off by default.** A member of the repository's workspace turns it public
in Settings › Repositories. It is then served at `/ideas/<owner>/<repo>`, for omni-loop
`/ideas/vertuoza/vertuo-omni-loop`, and members reach it from the sidebar under Work › Ideas.

**Who does what.**

| who | reads | votes | adds, edits, moves, archives, links a PRD |
|---|---|---|---|
| anyone, signed out | ✓ | — (▲ asks for a sign-in) | — |
| anyone signed in with GitHub | ✓ | ✓ one vote per idea, taken back by pressing ▲ again | — |
| a member of the workspace | ✓ | ✓ | ✓ |

**An idea** holds a title (at most 120 characters), a pitch (one paragraph, at most 600 characters),
its lane (`now`, `next` or `later`), who added it, when, its vote count, an optional PRD number, and
whether it is archived.

**The board.** Three lanes side by side, Now · Next · Later. A member sets the lane, and votes sort the
ideas inside a lane, most votes first, then the oldest first. A card shows the title, the pitch, the
count and a ▲ button. An idea with a PRD number shows an "In PRD #n" badge that links to the PRD's
GitHub issue. An archived idea leaves the board. On a phone the lanes stack, Now first.

- Rendered on the server with the public key, so a shared link has its title and preview, and search
  engines can read it.
- A board that is private, and a repository that has no board, answer the same "no public board
  here" page, so the page never tells which private repositories exist.

**Voting.** A signed-out visitor who presses ▲ signs in with GitHub and comes back to the board, where
the vote is counted. This sign-in asks for no `read:org` scope and never goes on to `/signup`: a voter
needs no workspace. Members sign in as they do today.

**Members.** Signed in, a member sees the same board with its controls: add an idea, edit its title
and pitch, move it between lanes, archive it, set its PRD number. Every card also shows a "Brainstorm
this" line to copy: `/omni:brainstorm '<title>: <pitch>'`.

**The terminal.** For a member, through `omni signin` and the workspace gate `omni dossier open`
uses:

```bash
node .omni-loop/bin/omni.mjs idea add '<title>' --pitch '<pitch>' [--lane now|next|later]
node .omni-loop/bin/omni.mjs idea list [--json]
```

`idea add` puts an idea in `later` when no lane is given and prints its board link; `idea list`
prints the board's ideas lane by lane with their votes. Both print one plain line and exit 0 on
`no sign-in`, `unreachable` or `refused`, as `omni dossier` does, and exit 2 on a bad argument.

**Storage.** One migration adds `ideas` and `idea_votes`, and a `public_ideas` flag on the
repository's row. Row-level security:

- anyone (`anon` and `authenticated`) reads the ideas of a repository whose flag is on, and never
  those of one whose flag is off;
- anyone reads the votes counted per idea of a public board (a count, never who voted, except
  the signed-in reader's own vote);
- a signed-in person adds and removes only their own vote, one per (idea, account), on a public
  board only;
- only a member of the repository's workspace writes an idea or the flag.

## Decisions

- **Omni page, not GitHub issues or a docs page.** Issues let anyone comment, which the read-and-vote
  board does not want, and cost GitHub API calls. A docs page cannot take votes.
- **Read and vote only.** No public comments and no public ideas: no free text from strangers to
  moderate.
- **A board per repository, off by default.** A workspace may hold private repositories, and an
  open-source one is public on its own.
- **The voice objected** (persona:Lead Engineer): a public vote count ranked top to bottom pulls the
  team toward what is loudest outside rather than what holds the codebase together. **Accepted:**
  members set each idea's lane (Now · Next · Later), and votes only sort ideas inside a lane.
- **The offering** was confirmed during the brainstorm as open core with a hosted app (offering#316).
- **Voters need no workspace.** Their sign-in skips `read:org` and `/signup`.
- **Proof:** a proof video is recorded once it ships.

## User stories

- As someone using omni-loop, I open the public board and see which ideas are planned Now, Next or
  Later, without signing in.
- As someone using omni-loop, I sign in with GitHub and vote for the ideas that matter to me, and take
  my vote back when I change my mind.
- As a member, I add my ideas from the terminal or the page, place each in a lane, and see which ones
  people vote for.
- As a member, I copy an idea's "Brainstorm this" line into Claude, and once its PRD exists I link it
  so voters see it is being built.
- As a member, I keep a private repository's board invisible from outside.

## Scope

In: the migration and its policies, the public board page, a voter's sign-in, the member controls,
the public toggle in Settings › Repositories, the Work › Ideas entry, `omni idea add` and
`omni idea list`, and a guide page `docs/guide/ideas.md`.

Out: comments, public submissions, an automatic link from `/omni:brainstorm` to an idea, notifications,
vote analytics, and import from any other tool.

## Test seams

Following `omni kb show testing`: tests sit beside the code, and none calls GitHub or Supabase.

- **Migration and policies:** a persistence test with realistic rows, for each rule of **Storage**:
  a public board read signed out, a private board read signed out (nothing), a second vote by the same
  account refused, a vote removed by someone else refused, an idea written by a non-member refused, a
  vote on a private board refused.
- **The board:** page tests for each state: empty board, three lanes sorted, an archived idea hidden,
  ▲ signed out (asks to sign in), vote and un-vote signed in, a PRD badge, a private or missing board
  (the same page), and the member controls.
- **A voter's sign-in:** a test that it asks no `read:org` scope, never redirects to `/signup`, and
  lands back on the board it started from, through an allowlist of board paths.
- **The terminal:** `omni idea add` and `omni idea list` through `main()` on a fixture repository,
  with the ideas port faked: added, listed, a bad lane (exit 2), `no sign-in` and `unreachable`
  (exit 0, one line).

## Risks

Merging publishes, per `omni kb show releasing`:

- **The database:** the migration is applied to production Supabase. It only adds two tables and one
  column defaulting to off. Rollback: a migration that drops `idea_votes`, `ideas` and the flag;
  nothing else reads them.
- **The kit:** `omni idea` ships in the kit and the plugin. Rollback: revert the command; it writes
  only to the two new tables.
- **The first public read of workspace data.** A policy mistake would expose a private repository's
  ideas. Guarded by the flag being off by default, by the policy tests above, and by the private and
  missing board answering the same page.
- **Vote stuffing** by many GitHub accounts: accepted for now; a vote needs a GitHub account, and
  the database holds one per (idea, account).

## Acceptance criteria

- A board whose flag is off answers "no public board here" at `/ideas/<owner>/<repo>`, exactly as a
  repository with no board does.
- With the flag on, a signed-out visitor sees the ideas in Now, Next and Later lanes, each lane sorted
  by votes, then by age, with no archived idea.
- A signed-out visitor who presses ▲ is asked to sign in with GitHub, is not asked for `read:org`,
  does not land on `/signup`, and comes back to the same board with the vote counted.
- A signed-in visitor's second press of ▲ removes their vote, and the count goes down by one.
- No one can count two votes from one account on one idea, vote on a private board, or remove
  someone else's vote.
- A signed-in person who is not a member sees no add, edit, move, archive or PRD control, and the
  database refuses such a write from them.
- A member adds an idea on the page and with `omni idea add`, moves it between lanes, archives it and
  sets its PRD number, and the board shows an "In PRD #n" badge linking to that issue.
- Every card shows a "Brainstorm this" line, `/omni:brainstorm '<title>: <pitch>'`.
- A member turns the board public and private again from Settings › Repositories.
- `omni idea list` prints the board's ideas lane by lane with their votes, and both `omni idea`
  verbs print one line and exit 0 when signed out or the app is unreachable.
- The board reads on a phone: the lanes stack, Now first.
