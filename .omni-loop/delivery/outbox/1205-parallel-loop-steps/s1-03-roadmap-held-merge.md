---
id: s1-03-roadmap-held-merge
prd: 1205
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Under a roadmap the tick already used the name held for the PRDs the roadmap holds or parks, and the pool needs it for the steps it keeps back: how do the two share it?

## The decision, in plain words

Under a roadmap, held lists the roadmap's held or parked PRDs first, unchanged and each marked with its gate, then the steps the pool keeps back. A PRD the roadmap already holds gets no second line.

## The intro, for fun

Two lists walked into one field name.

## The punchline, for fun

The roadmap kept its seat; the pool sat right behind it.

## The options, in plain words

A. A. One held list: the roadmap's PRDs first with their gate, then the pool's steps (built).
B. B. Keep held for the roadmap only and give the pool's list another name.
C. C. Give every entry a step and a gate, the pool's gate reading collision.

## What I had to decide

The spec names held for the pool's steps, each {step, prd, why}; under --roadmap, held already meant each PRD the roadmap holds or parks ({prd, gate, why, link}), and the drive skills park every entry of it. Renaming either would break a reader. Keeping the roadmap entries first and unchanged keeps today's readers working; the pool's entries carry no gate, so a reader tells them apart by it. The drive skills (slice s2) must park only the entries that carry a gate.

## What I did meanwhile

tickJson writes held as the roadmap's entries, then the pool's for PRDs the roadmap does not hold; the plain output prints each once.

## What it costs to change later

A constant: split the pool's entries into their own field in tickJson (kit/bin/commands/next.ts). Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Slice s2 has to read the gate field when it parks held PRDs; nothing in this slice can enforce that.
