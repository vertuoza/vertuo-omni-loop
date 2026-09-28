---
id: s3-01-verdict-follows-prose-rules
prd: 487
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The judge's short reason for its verdict, and its reason for keeping each finding, are published words. Should they follow the same strict wording rules as the rest of the retro, even though breaking one throws the whole verdict away?

## The decision, in plain words

They follow the same rules as every other published sentence of the retro: no digits, no links, no refused words, and a length cap of three hundred characters each. When one breaks a rule, the whole verdict is dropped and the retro counts as not judged, so no pull request opens.

## The intro, for fun

The judge has to watch its language as closely as the witnesses do.

## The punchline, for fun

One stray digit and the verdict is thrown out of court.

## The options, in plain words

A. A: every prose rule applies to the reason and each why, with caps of three hundred characters, and any failure drops the whole verdict
B. B: only the length caps apply to the reason and each why; other prose rules are not checked on them
C. C: a reason or why breaking a rule is dropped on its own, and the verdict survives when the rest holds

## What I had to decide

Whether the verdict's reason and each finding's why obey every prose rule (A), only the length cap the spec names (B), or are cleaned instead of dropped (C).

## What I did meanwhile

A verdict whose reason or why holds a digit, a link or a refused word is dropped, and the retro takes the quiet path with a comment reading not judged.

## What it costs to change later

A constant change in the guard and the field caps; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No live reply has been seen yet, so how often the model writes a digit in its reason is unknown (author).
