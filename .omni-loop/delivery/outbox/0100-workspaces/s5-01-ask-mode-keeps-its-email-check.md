---
id: s5-01-ask-mode-keeps-its-email-check
prd: 100
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The game now lets in whoever belongs to a workspace, whatever their email address. Should ask mode, the page where Claude's questions are answered, stop checking the email address too?

## The decision, in plain words

Not in this part of the work: the game no longer looks at the email address, but ask mode keeps its own check for a Vertuoza address in front of the workspace check. With Vertuoza the only workspace, nobody sees a difference yet.

## The intro, for fun

The game swapped its email check for a badge reader. Ask mode, next door, still squints at the address.

## The punchline, for fun

Both doors open for Vertuoza today; the second company will find out which one is stricter.

## The options, in plain words

A. Leave ask mode's own email check as it is, and let the database's membership check stand behind it. This is what was built.
B. Change ask mode to ask for a workspace instead of the email, in a follow-up slice of this plan.
C. Leave it for PRD 2, which opens sign-up to other companies and rewrites the sign-in anyway.

## What I had to decide

Whether to replace ask mode's own `isCrewEmail()` (`apps/galaxy/src/ask/auth.ts`, used by `authenticate()` and twice in `apps/galaxy/src/ask/cli-code.ts`) with a membership check. s5's row says "crew" means "has a workspace", and s5 removed the arcade's `isCrewEmail()` from `apps/galaxy/src/data/supabase-server.ts`. `src/ask/` is outside s5's territory, and outside every slice of this plan.

## What I did meanwhile

Left `src/ask/` untouched. The arcade's check is gone: the page reads memberships (`src/data/workspace.ts`) and `Session.crew` is true for a member of any workspace. Ask mode keeps its email check in front of the database's (`has_workspace()` in its policies and in `ask_cli_code_issue()`, item fix-s1-01-migration-after-ask-mode-01). In the callback, which is s5's, the terminal's sign-in (`next=ask-cli`) now calls `join_by_domain()` before its code is issued (`joinBeforeIssue()` in `src/data/sign-in.ts`), so a vertuoza.com account that has not opened the arcade since workspaces gets its code.

## What it costs to change later

A follow-up that edits `apps/galaxy/src/ask/auth.ts` and `cli-code.ts` (and their tests) to ask the database, for example `has_workspace()` through an RPC, instead of the email: a few lines and their tests, no stored shape. Until then, a member whose email is not @vertuoza.com is refused by ask mode's own 403, and a vertuoza.com account in no workspace meets the database's refusal instead of that 403.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether ask mode should follow the arcade now, or wait for PRD 2, which opens sign-up to other domains and rewrites the sign-in copy (author)
- which slice or PRD owns `src/ask/`: none of this plan's rows names it (author)
