---
id: s3-03-s3-slice-count-in-database
prd: 2401
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Where should a plan's slice count be worked out when a plan version is saved: by the database itself, copying the kit's rule, or by the app before it saves?

## The decision, in plain words

The database counts the slices itself as each plan version is saved, following the same rule the kit uses, so every way a plan arrives (the terminal and the GitHub fallback) gets its count. A plan with no slice the kit can read is stored as none, so the page never downloads its text again; plans saved before this keep no count and are read as before.

## The intro, for fun

Counting slices sounds easy until two places must count them the same way.

## The punchline, for fun

Both counters agreed on every one of the repository's 225 plans.

## The options, in plain words

A. The database counts, as built: one rule for every way a plan arrives.
B. The app counts with the kit's own rule and sends the count with each push.

## What I had to decide

Keep the count in the database (A), or have the app count and send it with each push (B).

## What I did meanwhile

`plan_slice_count()` mirrors `parsePlanSlices()` of `kit/lib/inbox/territory.ts` and a trigger stores it in `dossier_versions.slices` on insert, 0 for none; `readPlanSlices` reads it and falls back to the body only when it is null. The two counts were compared on every plan.md of this repository: they agree.

## What it costs to change later

A: the rule lives twice, in the kit and in the database; a change to the kit's slice table needs the same change in a migration. B: a migration changing the push function, and the GitHub fallback would need its own count.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test ties the two rules together on every change: the check proves the database rule on its own cases, and the agreement on the repository's plans was measured once by hand (author).
