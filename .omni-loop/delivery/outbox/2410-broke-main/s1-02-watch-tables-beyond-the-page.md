---
id: s1-02-watch-tables-beyond-the-page
prd: 2410
slice: s1
rank: high
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Should the database hold a little more than the before and after page drew, so the next slices have what they show and the database refuses what must never happen?

## The decision, in plain words

Each break keeps its name and whether the commit before it was green, and each decision on a finding goes into a log of its own. The database itself refuses the same finding twice, oversized findings, and a finding stored as already decided.

## The intro, for fun

The drawing had three boxes; the database grew a fourth while nobody was looking.

## The punchline, for fun

It only keeps receipts, and it never accepts the same receipt twice.

## The options, in plain words

A. A. Keep the additions as built: a break's name and its parent's result, the decisions' log, the database refusing a repeated finding, the caps.
B. B. Only what the page drew: the next slices read a break's name and parent from GitHub, a decision lives on the finding alone, and only the kit refuses a repeated finding.

## What I had to decide

Whether `supabase/migrations/20261228090000_main_watch.sql` keeps its additions to the drawn shape: `prd_main_breaks.title` and `parent` (green, red or unknown, a ci-red only); a fourth table, `rewind_finding_events`, the decision's event the plan asks for; `rewind_findings_once`, a unique index on the check, origin and evidence of a PRD; caps (20 https links of 500 characters, 4000 characters of text, a one-line reason of 500); and the App inserting only a finding's content, never its state. Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Built as option A and proven by supabase/checks/main_watch.sql; s2 writes the title and parent, s3 shows them, s5 maps a refused repeat to its own refusal.

## What it costs to change later

Each addition is dropped by a follow-up migration; the caps are constants of the migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the caps (20 links, 500 and 4000 characters) are not measured against real rewinds
- (author) the event log holds decisions only, not the proposal itself, whose time is on the finding
