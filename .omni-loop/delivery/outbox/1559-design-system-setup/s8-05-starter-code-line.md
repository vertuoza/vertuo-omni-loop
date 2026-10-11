---
id: s8-05-starter-code-line
prd: 1559
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

After a starter no part is built yet, and the setup guide asks to write that down; the design check then reads those words as a missing file and warns on every part. Should the guide ask for a bare none, or should the check accept the guide's words?

## The decision, in plain words

In the sample repository I wrote none for each part, which the check accepts, and said at the top of the file that nothing is built yet.

## The intro, for fun

A brand new design system, and the check already thinks every part went missing.

## The punchline, for fun

Hard to lose what was never built.

## The options, in plain words

A. A. The guide asks for a bare none after a starter, and the top of the file says nothing is built yet, as the sample does.
B. B. The check reads none yet, with any note after it, as nothing, so the guide's wording works as written.
C. C. Both: the guide asks for none, and the check also accepts none yet.

## What I had to decide

init.md says a starter's parts have no Code yet, 'and it says so'. Written as `Code: none yet (starter)`, the DESIGN.md reader keeps `none yet (starter)` as a path (only '', '—', '-' and 'none' read as nothing), so `omni check design` warns `part <name>: its code path none yet (starter) is gone` for all eight parts. I wrote `Code: none` in kit/test/fixtures/no-design-system/after/DESIGN.md and said in its intro that no part names a Code path yet.

## What I did meanwhile

The fixture's DESIGN.md uses `Code: none`, and `omni check design` prints no warning on it. The reader (kit/lib/design/system/read.ts) and init.md are unchanged: they are s1's and s4's ground, not this slice's.

## What it costs to change later

A constant either way: one line of init.md, or one entry in the reader's set of words that mean nothing, with a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person would rather read the words none yet in the file than a bare none (author).
