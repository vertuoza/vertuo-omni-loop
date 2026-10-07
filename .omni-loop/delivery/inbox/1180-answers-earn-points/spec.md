---
prd: 1180
title: Every answered question earns points
blocked-by: none
spec: file
---

# Every answered question earns points

**Date:** 2026-10-07 · **PRD:** #1180 · **Follows:** PRDs 144 (question history), 216 (PRD dossiers),
572 (dashboards), 728 (points in every repository) · **Touches:** `game/rulebook.ts`, `game/events.ts`,
`game/projector.ts`, `game/economy.ts`, `game/experience.ts`, `game/sources/supabase.ts`,
`game/sources/parsers.ts`, `game/cli/project.ts`, `kit/lib/ask/hook.ts`, `kit/lib/outbox/settle-merge.ts`,
a new migration under `supabase/migrations/` and its check under `supabase/checks/` · **Out of scope:**
rewriting any event already in the ledger, an alias list for past mis-named credits, a cap on paid
answers, answers that belong to no PRD.

## Problem

People who answer the agent's questions in the Claude terminal say they collect no points. Measured on
`main` on 2026-10-07, the truth is wider: **answering a question earns no points at all**, on the Omni
page or in the terminal.

- Points come only from the game ledger (`public.ledger_events`). `game:project` builds it from GitHub
  alone: secured zones, settled outbox items, bugs, feature PRs. Nothing reads `public.ask_rounds`.
- An answered round only moves the "Questions answered" count (`answered_counts()`, PRD 572), which
  the dashboards show apart from Points.
- A terminal answer reaches that count only when everything goes right. `postHook`
  (`kit/lib/ask/hook.ts`) drops it silently when the page round never opened (server down, no
  workspace), when the page round came back `closed`, or when one question was left empty, and it
  swallows every error.

The exploration also found two ways the ledger credits a name that matches no player:

- `settle-merge.ts` writes `Approved by: @<login>`, and the parser keeps the `@`.
- The `Approved by` parser accepts any word, dotted names included (`asked of clement.noterdaem`), which
  no GitHub login can be. This repository's own ledger lines spell one person two ways
  (`pierrederval`, `pierre-derval`).

The ledger keeps the first copy of each event forever (insert-if-new on its id), so a wrong name
written once is never corrected.

## Solution

1. **A new source: answered rounds.** A migration adds `public.game_answered_rounds(workspace uuid,
   since timestamptz)`, executable by the service role only. It returns, for each round of the
   workspace's ask sessions with `status = 'answered'` and `answered_at >= since`:
   - `round_id`, `answered_at`;
   - `prd`: the PRD the round belongs to, by the two rules `dossier_rounds()` already uses: the
     brainstorm rule (the round's ask session carries a numbered dossier's Claude session, within that
     dossier's window) or the delivery rule (the round's own `prd`, in the dossier's home repository).
     A round both rules match takes the brainstorm rule's PRD, as `dossier_rounds()` does;
   - `home`: that dossier's home repository, lower case;
   - `login`: the answerer's GitHub login, lower case, from the workspace roster.

   A round with no PRD or whose answerer has no login is not returned.
2. **A new event, `QUESTION_ANSWERED`.** `game:project` reads the source with `since` =
   `workspaces.game_since` and the projector turns each row into one event: id
   `ask:<round_id>:answered`, `at` = `answered_at`, `planet` = `prd`, `home`, `contributor` = `login`,
   `team` = the contributor's fleet. A row whose planet is not charted in this poll's snapshot waits for
   a later poll. The id never changes, so a round is paid once, however many polls see it.
3. **The pay.** `RULEBOOK.questionAnswered: 2` and `RULEBOOK.xp.weights.questionAnswered: 1`. `score()`
   pays it to the contributor, in the season of `answered_at`, with no multiplier. Threat, decay,
   terraform and the planet's state ignore the event.
4. **A terminal answer always reaches the page.** `postHook` records it:
   - when the pre hook could not open a round, by opening and answering in one call;
   - when the page round was `closed`;
   - when some questions were left empty, with the answered ones only;
   - and a failure prints one line on stderr instead of being swallowed.
5. **Clean names on new events.** The projector writes no event whose contributor is not a GitHub
   login (`^[a-z0-9](?:[a-z0-9-]{0,38})$`, lower case): it skips it through `onSkip`, so the event is
   written with the right name on the first poll after the name is fixed. `settle-merge.ts` writes the
   login without `@`.

## Decisions

- **Both the rule and the fixes in one PRD** (the person, 2026-10-07): answers earn points, and points
  reach the right player.
- **2 points per answered round.** Below the cheapest outbox answer (a transmission, 5), so asking many
  questions never outruns delivery work.
- **Only answers tied to a numbered PRD pay.** Every ledger event belongs to a planet; a brainstorm's
  answers pay once its draft dossier is numbered. Answers from a spike or ad-hoc work still count as
  Questions answered.
- **Backfilled from `game_since`.** Past answered rounds tied to a PRD become events on the first poll
  after the merge, dated when they were answered.
- **History stays as it is.** Events already in the ledger under a wrong name (`pierre-derval`, `@login`)
  are not rewritten or aliased; only new events are kept clean.
- **A new event type, not a wound kind.** A wound is born open and counts toward threat and decay; an
  answer is born closed. Scoring straight from `ask_rounds` on the dashboard was refused too: points
  and XP would disagree and past seasons could not be replayed.
- **The voice's objection** (persona:Lead Engineer: paying for clicks invites farming by always picking
  the recommended option) was heard and settled `none`: the person approved the design unchanged, the
  2-point pay and the PRD-only rule keeping farming worth little. No daily cap.
- **No proof video:** the only visible change is a number on the board.

## User stories

- As someone who answers the agent's questions in the Claude terminal, I see 2 points per answer on the
  board after the next poll, as I would had I answered on the page.
- As someone who answered questions during last month's brainstorms, my past answers on numbered PRDs
  count in last month's season and in my XP.
- As a player, I never lose a credit because a settled line spelt my name with `@` or a dot: the event
  waits until the name is fixed.

## Scope

In: the migration and its check, the event type, the rulebook numbers, the source and projector, the
economy and XP, the four `postHook` cases, the contributor check and `settle-merge.ts`'s `@`.

Out: rewriting or aliasing existing ledger events, a cap on paid answers, rounds with no PRD, the
"Questions answered" count (it stays as it is), the dashboards' layout (Points already shows every
credit).

## Test seams

Following `omni kb show testing`: tests beside the code, on fixtures, never calling GitHub or Supabase.

- `game/projector.test.ts`: one `QUESTION_ANSWERED` per row, the same id on two polls, nothing for a row
  whose planet is not charted, a skip for a contributor that is not a login.
- `game/economy.test.ts`: an answer pays 2 in the season of `answered_at`; it changes no threat, decay
  or terraform number.
- `game/experience.test.ts`: answers add to XP by their weight.
- `game/sources/supabase.test.ts`: the source's rows parse; a failed read skips the answers and keeps the
  GitHub events.
- `game/sources/parsers.test.ts` and `kit/lib/outbox/settle-merge.test.ts`: no `@`, no dotted contributor.
- `kit/lib/ask/hook.test.ts`: open-failed, closed, partly answered, and a failure printing one line.
- `supabase/checks/game_answered_rounds.sql`: only the given workspace, only since `since`, both rules,
  and refused to anyone but the service role.

## Risks

Following `omni kb show releasing`, a merge publishes:

- **The database:** the migration reaches production through the `supabase` workflow. It only adds a
  function. Rollback: a follow-up migration drops it.
- **The ledger:** the first hourly `game.yml` poll after the merge writes the backfill. Ledger events are
  permanent. Rollback: set `questionAnswered` and its XP weight to 0, and the next poll's `game:score`
  and `game:xp` remove those points; the events stay, paying nothing.
- **The kit:** the new `postHook` ships to every installed repository. Rollback: revert; a terminal
  answer then goes back to being dropped in the three cases.

## Acceptance criteria

1. A round answered in the terminal and a round answered on the page, both tied to the same PRD, each
   give their answerer 2 points and the same XP on the next `game:score` and `game:xp`.
2. A round answered before the merge, after `game_since`, tied to a numbered PRD, is in the ledger
   after the first poll, dated when it was answered, and counts in that month's season.
3. A round tied to no PRD writes no event and still counts in Questions answered.
4. Two polls over the same rounds append each `QUESTION_ANSWERED` once.
5. After `QUESTION_ANSWERED` events are added, threat, decay and terraform give the same numbers as
   before.
6. A terminal answer is recorded on the page when the pre hook could not open a round, when the round
   came back `closed`, and when one question was left empty; a failed post prints one line.
7. No new ledger event has a contributor with `@`, a dot, or upper case; such an event is skipped with
   a warning and written once the name is fixed.
