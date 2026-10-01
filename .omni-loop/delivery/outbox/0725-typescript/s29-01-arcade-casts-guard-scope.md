---
id: s29-01-arcade-casts-guard-scope
prd: 725
slice: s29
rank: medium
bears-on: none
raised: 2026-10-01
wave: 6
---

## The question, in plain words

Two parts of the web app left their shortcuts in the types unexplained, about two hundred lines. Should the new guard refuse them now, or leave those parts alone until someone explains each one?

## The decision, in plain words

The guard leaves those two parts alone for now and holds the rest of the repository, the web app included, to the rule. A short list in the guard names the parts left out, so each can be taken off the list once its shortcuts are explained.

## The intro, for fun

Two hundred shortcuts walked in without a note from home.

## The punchline, for fun

They get a hall pass, and the hall pass has an expiry list.

## The options, in plain words

A. A: the guard skips casts in the folders s25 and s27 left unmarked, named in one list, and reads every other folder (what I built)
B. B: mark every arcade cast with its own reason now, and drop the list
C. C: leave the whole web app out of the cast rule, keeping only the other two rules there

## What I had to decide

How the ratchet's guard covers apps/galaxy for any and as, given that s25 and s27 left their casts unmarked (settled items s25-01, s27-01) while s24, s26 and s28 marked theirs, and the spec's Out list keeps the arcade's code unchanged beyond index checks and the Database type.

## What I did meanwhile

kit/test/typescript-guard.ts holds ARCADE_UNMARKED: the twelve folder prefixes of s25 and s27 (plus apps/galaxy/proxy.ts). Files there are not read for any or as; @ts-nocheck and JavaScript files are still refused there. Every other arcade folder is read like the kit; the seven casts s24 and s28's folders and packages/galaxy had missed now carry a ts-allow reason (comments only). Tests, and files under a test/ folder (apps/omni-app/test/*-scenario.ts, github-replay.ts), may cast freely, as the spec lets tests cast fixtures; the generated supabase/database.types.ts is not read for casts; as const, import and export aliases and non-null assertions are not counted.

## What it costs to change later

Cheap: striking a folder from ARCADE_UNMARKED and adding a ts-allow comment to each of its casts (about 196 lines today) changes no code. The test/ folder exemption is one regular expression.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether the guard's any/as rule reaches the arcade, whose code the Out list keeps unchanged
- (author) Whether a file in a test/ folder that only serves tests counts as a test for the cast rule is not written
