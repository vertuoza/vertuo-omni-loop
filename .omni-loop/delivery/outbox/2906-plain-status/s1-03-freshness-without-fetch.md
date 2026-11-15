---
id: s1-03-freshness-without-fetch
prd: 2906
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The spec words the freshness line for two cases only: checked just now, and an older copy because GitHub did not answer. What should the last line say when the status was read from this computer alone, without asking GitHub, or when nothing was ever read?

## The decision, in plain words

Read from this computer alone, it says how old the copy is, without blaming GitHub, and says just now under a minute. With no copy at all, it says the work was not checked yet, adding that GitHub did not answer only when it was asked.

## The intro, for fun

A clock that only knows two times is right twice a day.

## The punchline, for fun

This one also knows when nobody asked it the time.

## The options, in plain words

A. Say the copy's age without blaming GitHub when it was not asked, and say not checked yet when nothing was read: what was built.
B. Leave the freshness line out when GitHub was not asked.
C. Always print the two lines of the spec, saying GitHub did not answer even when it was not asked.

## What I had to decide

Built in `kit/lib/now/status/render.ts` (`freshnessLine`) and `words.ts` (`FRESHNESS`), from `checked: { at, fetch }` where `fetch` is `answered`, `no-answer` or `not-asked`. `answered`: `Checked just now.` `no-answer` with a copy: `Checked <m> min ago (GitHub did not answer).`, `<m>` at least 1. `not-asked` with a copy: `Checked <m> min ago.`, or `Checked just now.` under a minute. No copy: `Not checked yet (GitHub did not answer).` when asked, `Not checked with GitHub yet.` when not. The spec's `omni now --status` (no `--fetch`) reads only this computer, so its line had no wording in the spec.

Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built the five lines above in the one table of words and tested each in render.test.ts.

## What it costs to change later

A constant: five strings in the table and one small pure function; s2 only passes whether it asked and whether GitHub answered.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person would rather see no freshness line at all when GitHub was not asked.
