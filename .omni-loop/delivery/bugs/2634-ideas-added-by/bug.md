# Bug 2634: a public board's ideas give away who added them to people outside the workspace

## Triage

- **Domain:** ideas board (`public.ideas`, its grants and read policies)
- **Risk:** medium — whoever added an idea to a public board: anyone outside the workspace can read their account ID and the workspace's ID through the public key; both are opaque IDs, no name or email, and nothing of a private board.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `supabase/checks/ideas.sql`
- **Level:** unit
- **Red:** `psql:/tmp/checks/ideas.sql:145: ERROR:  FAIL: anyone signed out reads who added an idea`

## Fix

The table's read grant and its public-board policy gave anyone every column of a public board's ideas, though `ideas_board()`, which the page reads, leaves `added_by` and `workspace_id` out. Signed out, the table now answers only the columns `ideas_board()` shows; signed in, someone outside the workspace reads the board through `ideas_board()` alone, since a column grant cannot tell them from a member. `ideas_board()` and `ideas_public_board()` stay callable signed out, because the page and the policy need them.

## Guard

A block in `supabase/checks/access.sql`, which CI runs on every pull request: it lists the exact columns of `public.ideas` anyone signed out can read, so a column added later fails until someone decides, and it refuses a public-board policy open to signed-in non-members. It failed on the code before the fix (`FAIL: anyone signed out reads these columns of public.ideas: added_by, archived, ...`) and passes after it. `supabase/checks/ideas.sql` itself is not run by CI.

## Mutation

mutation: no changed core file against origin/main (e43ed4f8): nothing to mutate
