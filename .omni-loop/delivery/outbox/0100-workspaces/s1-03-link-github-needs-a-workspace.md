---
id: s1-03-link-github-needs-a-workspace
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should someone who belongs to no workspace be able to link their GitHub account?

## The decision, in plain words

No: linking answers only people who belong to at least one workspace, as it answered only Vertuoza accounts before. Its refusal no longer names Vertuoza.

## The intro, for fun

Linking GitHub without a workspace is like getting a locker key without a gym membership.

## The punchline, for fun

Harmless, maybe, but the front desk still asks which gym you are with.

## The options, in plain words

A. Refuse people who belong to no workspace, as other domains were refused before. This is what was built.
B. Answer anyone signed in; someone with no workspace simply has no player to update.

## What I had to decide

`link_github()` used to refuse any caller for whom `is_crew()` was false, with 'Sign in with your vertuoza.com account first.' The spec says what it refreshes (every player row of the caller) but not whom it refuses. It now raises 42501 for a caller with no `workspace_members` row: 'Sign in with an account of a workspace first.' The auth callback shows that message, so s5 should call `join_by_domain()` before `link_github()`; otherwise a session that predates the migration and links GitHub first is refused once.

## What I did meanwhile

Membership guard in `link_github()`; `supabase/checks/access.sql` proves an outsider with GitHub linked is refused, and a member is answered.

## What it costs to change later

One condition and one message in `link_github()`, redefined by a forward migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the order in which s5's auth callback calls join_by_domain() and link_github() is s5's to settle, and is not built yet (author)
