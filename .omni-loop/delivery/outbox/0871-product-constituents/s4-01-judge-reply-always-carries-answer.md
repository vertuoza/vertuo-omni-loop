---
id: s4-01-judge-reply-always-carries-answer
prd: 871
slice: s4
rank: high
bears-on: ADR-0029
raised: 2026-10-01
wave: 2
---

## The question, in plain words

When the inbox check asks the judge and today's verdict is the one that counts, should the reply still say that verdict, and what should happen for a repository no workspace tracks?

## The decision, in plain words

The judge always says the verdict that counts, today's included, so the inbox check reads one answer. A repository no workspace tracks gets today's verdict back rather than a refusal.

## The intro, for fun

Who gets the last word on a broken spec, and what if nobody owns the repository?

## The punchline, for fun

The judge always speaks up, even when it only repeats what it was told.

## The options, in plain words

A. Always carry the answer, and an untracked repository answers today's verdict, so the gate reads one field.
B. Carry no answer when today's counts, as the terminal route does, and the gate keeps its own answer.
C. Refuse an untracked repository, which the gate then reads as neutral and loses today's verdict.

## What I had to decide

Whether the judge's reply always carries the answer, and how it treats a repository no workspace tracks.

## What I did meanwhile

The judge answers {answer, confidence, decidedBy} on every call; answer is today's verdict when today's counts, and an untracked repository answers today's verdict with decidedBy old. It signs with the stage events' header (x-omni-signature-256) under CONSTITUENT_JUDGE_SECRET.

## What it costs to change later

Switching to the terminal route's shape (no answer when today's counts) changes one reply line here and one read in the canon gate (s5).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say which reply shape the canon gate (s5) prefers to read (author)
