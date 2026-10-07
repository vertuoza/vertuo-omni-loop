---
id: s2-02-roadmap-any-member-pushes
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

A loop on the Omni page belongs to the person who runs it, and only they can update it. Should a roadmap work the same way, or belong to the whole workspace?

## The decision, in plain words

A roadmap belongs to its workspace: any member can update it, and the last person who did is recorded. Two people driving the same roadmap both keep its page current.

## The intro, for fun

Whose roadmap is it anyway? Everyone's, as it turns out.

## The punchline, for fun

The page just remembers who touched it last.

## The options, in plain words

A. A. Any member of the workspace updates it; the last pusher is recorded (built).
B. B. Only the person who first sent it updates it; anyone else is refused, as a loop is.

## What I had to decide

Whether any member of the workspace may update a roadmap, or only the person who first sent it.

## What I did meanwhile

Any member's `omni roadmap push` replaces the roadmap's document and PRD rows; the row keeps `pushed_by`.

## What it costs to change later

Restricting it later is one change to the database function, and a refusal the push command learns to print.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only roadmap_push() writes and members read; it does not say who among the members may push. (author)
