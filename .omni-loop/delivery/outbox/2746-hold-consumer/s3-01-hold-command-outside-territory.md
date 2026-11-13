---
id: s3-01-hold-command-outside-territory
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

The plan gave this step the hold's logic but not the command that runs it, its help text, or a test that counts the hook points. Was it right to change those three files too?

## The decision, in plain words

I made the smallest change in each: the command now asks for the provider's settings and passes them on, its help text says what a probe is, and the count of hook points went from 12 to 13. All the new logic stays where the plan put it.

## The intro, for fun

The plan drew a fence, and the gate was on the other side of it.

## The punchline, for fun

So I stepped over it, touched three things, and wrote it down.

## The options, in plain words

A. A. Keep the three small changes: the command, its help and the count follow the new probe.
B. B. Revert them and add the three paths to s3's territory in the plan, then redo the same change.

## What I had to decide

Whether a slice may make the small wiring change its own feature needs in a file the plan gave to an earlier slice of the same PRD.

## What I did meanwhile

The three files carry the change; slice s1, which owned them, is already merged into the feature branch, so no other slice of the wave touches them.

## What it costs to change later

Undoing it means moving the provider read back out of the command and dropping two help sentences: a few lines, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- kit/bin/commands/hold.ts, kit/lib/help/entries.ts and kit/lib/flow/resolve.test.ts were not in s3's territory (author)
