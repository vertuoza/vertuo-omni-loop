# Plan: a public ideas board people can vote on

PRD #1246, specified in `spec.md` beside this plan. The feature branch `feat/public-ideas-board`
merges into `main` with `Closes #1246`; each slice is a sub-PR from `feat/public-ideas-board--<slice>`
into the feature branch, with `Part of #1246`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A board whose flag is on is read by anyone at `/ideas/<owner>/<repo>`, in Now · Next · Later lanes sorted by votes; a private or missing board answers "no public board here" | `supabase/migrations/` `supabase/checks/ideas` `supabase/database.types.ts` `supabase/seed.sql` `apps/galaxy/app/ideas/` `apps/galaxy/src/ideas/` | — | 1 |
| s2 | A member adds ideas and lists the board from the terminal with `omni idea add` and `omni idea list` | `kit/lib/idea/` `kit/bin/commands/idea` `kit/bin/commands/index.ts` `kit/lib/commands.ts` `kit/lib/help/` `apps/galaxy/app/api/ideas/` `apps/galaxy/src/ideas/api/` | s1 | 2 |
| s3 | Anyone signed in with GitHub votes, and takes the vote back, one per idea; a voter's sign-in asks no `read:org`, skips `/signup` and returns to the board | `apps/galaxy/src/ideas/vote/` `apps/galaxy/src/ideas/Board` `apps/galaxy/app/auth/callback/` `apps/galaxy/src/data/sign-in` | s1 | 2 |
| s4 | A member edits, moves between lanes, archives and links a PRD on the page, copies each card's "Brainstorm this" line, reaches the board from Work › Ideas, and turns it public or private in Settings › Repositories | `apps/galaxy/src/ideas/members/` `apps/galaxy/src/ideas/Board` `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` `apps/galaxy/src/nav/` `docs/guide/ideas.md` `docs/guide/meta.json` | s1 | 3 |

**Shared ground.** `apps/galaxy/src/ideas/` belongs to s1, which builds the board (`Board.tsx` and its
page test `Board.test.tsx`), its data and its public page. s2, s3 and s4 each work in their own
subfolder of it (`api/`, `vote/`, `members/`) and run after s1. s3 and s4 both change the board
component and its page test (`apps/galaxy/src/ideas/Board*`): s3 adds the ▲ vote, and s4 adds the
member controls. Both declare that prefix, so the check puts s4 in wave 3, after s3. Only s1 touches
`supabase/database.types.ts` and the migration, which holds every table, column and policy the later
slices need. `kit/dist/` is generated and listed by no slice.

## Per slice: done when

**s1**
- One migration adds `ideas` (title ≤ 120, pitch ≤ 600, lane `now|next|later`, added by, created at,
  PRD number, archived), `idea_votes` (one row per idea and account), and `public_ideas` on
  `public.repositories`, defaulting to off, with the policies of the spec's **Storage**.
- `supabase/checks/ideas.sql` proves each rule of the spec's **Storage**: public read signed out,
  private read empty, a second vote refused, someone else's vote not removable, a non-member's idea
  write refused, a vote on a private board refused.
- `/ideas/<owner>/<repo>` renders the three lanes, each sorted by votes then by age, without
  archived ideas, server-side with the public key, with the board's title in its metadata.
- A private board and a missing one render the same "no public board here" page.
- On a phone the lanes stack, Now first.
- Page tests cover the empty board, the sorted lanes, the hidden archived idea, the PRD badge, and
  the private and missing board.

**s2**
- `omni idea add '<title>' --pitch '<pitch>' [--lane now|next|later]` adds an idea in `later` by
  default and prints its board link. `omni idea list [--json]` prints the ideas lane by lane with
  their votes.
- Both go through `omni signin` and the workspace gate `omni dossier open` uses. They print one line
  and exit 0 on `no sign-in`, `unreachable` and `refused`, and exit 2 on a bad lane, a title over
  120 characters or a pitch over 600.
- `omni help idea` describes both verbs.
- Tests run `main()` on a fixture repository with the ideas port faked, plus the API route's
  validation, response shape and refusals.

**s3**
- A signed-out ▲ starts a GitHub sign-in with no `read:org` scope that returns to the same board
  (the board path is allowlisted) and never goes on to `/signup`, and the vote is counted on return.
- A signed-in ▲ adds the vote. A second press removes it. The count changes by one each time, and
  the card shows the reader's own vote as pressed.
- Tests cover the signed-out ▲, vote and un-vote, a callback that refuses a return path off the
  allowlist, and a voter in no workspace landing back on the board.

**s4**
- A member signed in sees the board's controls: add, edit title and pitch, move between lanes,
  archive, set a PRD number (shown as an "In PRD #n" badge linking to the issue). A non-member sees
  none of them.
- Every card shows its "Brainstorm this" line, `/omni:brainstorm '<title>: <pitch>'`, with a copy
  button.
- Work › Ideas in the sidebar opens the workspace's board. Settings › Repositories turns each
  repository's board public and private again.
- `docs/guide/ideas.md` explains the board, voting, the lanes and `omni idea`.
- Tests cover each member control, the non-member view, the sidebar entry and the toggle.
