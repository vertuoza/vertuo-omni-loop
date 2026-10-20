---
id: s1-02-proposal-names-who-it-waits-for
prd: 2268
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a member's change is only proposed, the terminal must say who it waits for, but the answer the spec describes carries no name. Where does the name come from?

## The decision, in plain words

The route's answer gains one more field: the login of the section's owner, or its delegate when it has no owner, and nothing when the section names nobody and its workspace's owners decide.

## The intro, for fun

The note said it waits for someone, then forgot to say who.

## The punchline, for fun

Now the note carries a name, unless nobody signed up for the job.

## The options, in plain words

A. The answer names the section's owner, else its delegate, else nobody, as built.
B. The answer names nobody, and the terminal prints the list's link alone.

## What I had to decide

How the terminal learns who a proposal waits for, which the spec's line `proposed · waits for @<owner> · <url>` needs and the spec's answer `{done, id, url}` does not carry.

## What I did meanwhile

Built: every answer of POST /api/knowledge/changes carries `waitsFor`, the owner's login, else the delegate's, else null; it is null for an applied change. Slice s2's `proposed · waits for @<owner>` line can read it from there.

## What it costs to change later

A constant: one additive field of a JSON answer, read by the kit's client alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slice s2 is built from the spec alone, in parallel: it must read this field to print the owner (author)
- What the terminal prints when the section names nobody is s2's to word (author)
