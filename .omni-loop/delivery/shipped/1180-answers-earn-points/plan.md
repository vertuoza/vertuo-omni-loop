# Plan: every answered question earns points

PRD #1180, spec in `spec.md` beside this plan. The feature branch `feat/answers-earn-points` merges into
`main` with `Closes #1180`; each slice is a sub-PR from `feat/answers-earn-points--<slice>` into the
feature branch, with `Part of #1180`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | An answered round tied to a numbered PRD becomes one `QUESTION_ANSWERED` ledger event that pays its answerer 2 points and XP, backfilled from `game_since` | `supabase/migrations/` `supabase/checks/game_answered_rounds.sql` `supabase/database.types.ts` `game/events` `game/rulebook` `game/economy` `game/experience` `game/projector` `game/sources/supabase` `game/cli/project.ts` `game/README.md` `apps/galaxy/src/dashboard/` `packages/galaxy/` | — | 1 |
| s2 | A terminal answer always reaches the page: recorded when the pre hook could not open a round, when the round came back closed, and when a question was left empty; a failed post prints one line | `kit/lib/ask/` `apps/galaxy/src/ask/` `kit/dist/omni.mjs` | — | 1 |
| s3 | No new ledger event credits a name that is not a GitHub login: the projector skips it with a warning, and a merge over red writes the login without `@` | `game/projector` `game/sources/parsers` `game/sources/github.test.ts` `kit/lib/outbox/settle-merge` `kit/dist/omni.mjs` | s1 | 2 |

**Shared ground.**

- `game/projector` (the projector and `game/projector.test.ts`): s1 adds the new event, s3 adds the
  contributor check. s3 is blocked by s1 and sits in wave 2, so it builds on s1's projector.
- `kit/dist/omni.mjs`: the committed kit build, which both kit slices rebuild. s2 is in wave 1 and s3
  in wave 2, so the second rebuild starts from the first.
- `supabase/migrations/`: only s1 adds a migration.

## Per slice: done when

**s1**

- `public.game_answered_rounds(workspace, since)` returns only that workspace's answered rounds since
  `since`, each with its PRD by the brainstorm or delivery rule, its home repository and the answerer's
  lower-case login. It returns no round without a PRD or a login, and refuses anyone but the service
  role (`supabase/checks/game_answered_rounds.sql`).
- `game:project` reads it and appends one `QUESTION_ANSWERED` per round, id `ask:<round_id>:answered`,
  dated `answered_at`. Two polls over the same rounds append each event once. A row whose planet is not
  charted writes nothing yet. A failed read keeps the GitHub events and prints why.
- `score()` pays 2 points per answer in the season of `answered_at`, and threat, decay and terraform
  numbers are unchanged with answer events present (`game/economy.test.ts`).
- XP counts answers at weight 1 (`game/experience.test.ts`).
- The Points tile and the People tables count answer points without a layout change.

**s2**

- `kit/lib/ask/hook.test.ts`: a terminal answer is posted with `via: 'terminal'` when the pre hook
  could not open a round, when the round came back `closed`, and with only the answered questions when
  one was left empty.
- A post that fails prints exactly one line on stderr, and the session carries on.
- A page answer is still never posted again from the terminal.
- The server accepts what the hook sends (`apps/galaxy/src/ask/api.test.ts`), and `kit/dist/omni.mjs`
  equals a fresh build.

**s3**

- The projector writes no event whose contributor fails `^[a-z0-9](?:[a-z0-9-]{0,38})$`. It skips the
  event through `onSkip` with a warning naming it, and writes it on the first poll after the name is
  fixed (`game/projector.test.ts`).
- `parseOutboxItem`'s approver yields no `@` and no dotted name (`game/sources/parsers.test.ts`).
- `settle-merge` writes `Approved by: <login>` without `@` (`kit/lib/outbox/settle-merge.test.ts`), and
  `kit/dist/omni.mjs` equals a fresh build.
