# Plan: members vote on their own private ideas board

PRD #1258, specified in `spec.md` beside this plan. The feature branch
`feat/members-vote-private-board` merges into `main` with `Closes #1258`; each slice is a sub-PR from
`feat/members-vote-private-board--<slice>` into the feature branch, with `Part of #1258`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A member of the workspace votes for an idea of their own private board, and takes the vote back; the votes stay counted once the board goes public, and nobody outside the workspace votes there | `supabase/migrations/` `supabase/checks/ideas` `docs/guide/ideas.md` | — | 1 |

**Shared ground.** None: one slice. Its migration only redefines `idea_votable()`, whose signature
does not change, so `supabase/database.types.ts` is not regenerated and no slice lists it.

## Per slice: done when

**s1**
- One new migration, dated after `20261115090000_ideas.sql`, redefines `public.idea_votable(p_idea)`:
  true when the idea is not archived and either its board is public or the caller is a member of the
  idea's workspace. The `idea_votes` policies, the tables and the grants are unchanged. Its header
  names the rollback: the old body.
- `supabase/checks/ideas.sql` proves, on realistic rows:
  - a member votes on an idea of their private board and takes it back, and `ideas_board()` answers
    the count and `voted` for them in between;
  - a member's second vote on the same idea is refused;
  - a member's vote on an archived idea of their private board is refused;
  - a signed-in person in no workspace is still refused on a private board;
  - a member's vote cast while private is still counted by `ideas_board()` once the board is public.
- `docs/guide/ideas.md` says, in its who-votes table and its Vote section, that a member votes on
  their board while it is private and that those votes stay counted when it goes public.
- `pnpm test` is green.
