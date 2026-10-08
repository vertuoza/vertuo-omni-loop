---
id: s5-01-building-line-keeps-stuck-and-items
prd: 1208
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 5
---

## The question, in plain words

While a PRD is being built, should the bottom line also say which slices are stuck and how many questions are waiting, though the spec's example line shows neither?

## The decision, in plain words

Yes: after the slices being built, the line names the stuck slices in red and the count of waiting questions, as the old line did. The slice the branch names is no longer shown, as the acceptance criteria ask.

## The intro, for fun

The example line looked tidy because nothing was stuck that day.

## The punchline, for fun

Real days come with a red word or two.

## The options, in plain words

A. A. Keep the stuck slices in red and the open item count on the building line (built).
B. B. Show exactly the spec's parts: stage, wave and the slices in flight, nothing more.
C. C. Keep the stuck slices, drop the open item count.

## What I had to decide

Whether the second line of a PRD being built keeps the stuck slices and the open item count that PRD 324's line showed, beyond the spec's example.

## What I did meanwhile

The building line reads the stage, the wave, 'now' and the slices in flight, then 'stuck' and the stuck slices in red, then the open items; each part is left out when it has nothing to say. The slice a slice branch names is no longer shown.

## What it costs to change later

Removing either part is one line in the status line's render; the width rule already cuts them last.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's example building line shows no stuck slice and no open item; it does not say whether they were left out on purpose or only absent in that example. (author)
