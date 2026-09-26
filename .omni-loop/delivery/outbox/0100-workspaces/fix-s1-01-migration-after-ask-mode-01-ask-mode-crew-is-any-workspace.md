---
id: fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace
prd: 100
slice: fix-s1-01-migration-after-ask-mode
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Now that people reach the game through workspaces, who may use ask mode, the page where Claude's questions are answered?

## The decision, in plain words

Anyone who belongs to at least one workspace, whichever it is, and each person still sees only their own questions. A company email address alone is no longer enough.

## The intro, for fun

Ask mode used to check your email address at the door. Now it checks your badge instead.

## The punchline, for fun

Any company's badge opens it, and nobody gets to read anyone else's questions.

## The options, in plain words

A. Anyone who belongs to at least one workspace may use ask mode, and sees only their own questions. This is what was built.
B. The same, and signing in from the terminal first joins the person to their company's workspace, so ask mode works before the arcade is ever opened.
C. Only the members of one workspace, Vertuoza today, may use ask mode, and each question is filed under it.
D. Anyone signed in may use ask mode, member of a workspace or not.

## What I had to decide

PRD #71 shipped first. Its migrations `20260926090000_ask_sessions.sql` and `20260926100000_ask_cli_codes.sql` gate ask mode on `is_crew()` (a token email ending in `@vertuoza.com`): six row-level policies on `ask_sessions` and `ask_rounds`, and the body of `ask_cli_code_issue()`. s1's migration drops `is_crew()`, so the chain failed on an empty database. Item s1-01 settled that the branch shipping second rewrites them for membership. The spec says crew becomes membership (`is_member(workspace)`), and s5's row says crew means has a workspace; but the ask tables carry no `workspace_id`, and the spec does not say which workspace, if any, an ask session belongs to.

## What I did meanwhile

In `supabase/migrations/20260926120000_workspaces.sql`, before `drop function public.is_crew()` (still without cascade): a new `public.has_workspace()`, stable and security definer, true when `auth.uid()` has a `workspace_members` row in any workspace. `alter policy` on the six ask policies trades `public.is_crew()` for `(select public.has_workspace())` and keeps every owner check as #71 wrote it. `ask_cli_code_issue()` is redefined with the same guard and `link_github()`'s refusal, 'Sign in with an account of a workspace first.' (item s1-03); `link_github()` now calls `has_workspace()` too. No workspace column is added. `supabase/checks/access.sql` proves it for a member of either workspace, an account in no workspace (a vertuoza.com one included) and an anonymous visitor, and fails on any function body still calling `is_crew()`; `supabase/checks/ask.sql`'s two askers now belong to Vertuoza.

## What it costs to change later

One function body: `has_workspace()` in `supabase/migrations/20260926120000_workspaces.sql`, edited in place before the feature PR merges, redefined by a forward migration after. Option B adds one line to `ask_cli_code_issue()` in the same file. Option C would add a workspace column to `ask_sessions`, a migration with a backfill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec does not say whether an ask session belongs to a workspace or only to the person, so which workspace it would name is not known (author)
- the `omni signin` return (`next=ask-cli` in `apps/galaxy/app/auth/callback/route.ts`, then `apps/galaxy/src/ask/cli-code.ts`) never calls `join_by_domain()`, so a vertuoza.com account that has not opened the arcade since the migration is refused a sign-in code until it does; `src/ask/` is outside every slice's territory (author)
- `apps/galaxy/src/ask/auth.ts` and `cli-code.ts` still let any @vertuoza.com address through as crew (`isCrewEmail()`), so for an account in no workspace the ask API meets the database's refusal instead of its own 403 (author)
