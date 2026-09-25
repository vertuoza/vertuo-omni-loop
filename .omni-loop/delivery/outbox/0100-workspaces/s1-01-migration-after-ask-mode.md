---
id: s1-01-migration-after-ask-mode
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Two projects change the game's database at the same time: workspaces, and the ask mode. In which order should their changes apply?

## The decision, in plain words

The workspaces change is dated after the ask mode's, so it applies last whichever ships first. If the ask mode ships first, the workspaces change stops with an error instead of quietly removing the ask mode's access rules, and the workspaces branch rewrites those rules for membership before it ships.

## The intro, for fun

Two database changes walk into production. Only one of them can go first.

## The punchline, for fun

We picked the polite one: it waits its turn, and it complains loudly if pushed.

## The options, in plain words

A. Date the workspaces change after the ask mode's, and let it stop loudly if the ask mode landed first. This is what was built.
B. Date it today, before the ask mode's, so the ask mode must be re-dated and rewritten if it ships second.
C. Have the workspaces change remove the ask mode's access rules by force when they exist, and rebuild them for membership in the same change.

## What I had to decide

The migration's timestamp. PRD #71 (ask-mode, `feat/ask-mode`) adds `20260926090000_ask_sessions.sql` and `20260926100000_ask_cli_codes.sql`, whose policies call `is_crew()`, which this migration drops. `supabase db push` refuses a local migration dated before the last one applied to production, so a workspaces migration dated today (`20260925…`) would be refused outright if #71 shipped first.

## What I did meanwhile

Named it `supabase/migrations/20260926120000_workspaces.sql`, after both of #71's. `drop function public.is_crew()` carries no `cascade`: if #71 has shipped first, the drop fails on #71's policies and the deploy stops, rather than silently dropping #71's row-level security. The spec's Risks already say #71 must move to `is_member()`; whichever PRD ships second merges `main` and does that rewrite.

## What it costs to change later

Renaming one file before the feature PR merges. Once production has applied it, the name is history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- which of #71 and #100 ships first is not decided anywhere (author)
