---
id: s29-02-last-unchecked-files-typed-here
prd: 725
slice: s29
rank: medium
bears-on: none
raised: 2026-10-01
wave: 6
---

## The question, in plain words

The final tightening found a few files no earlier step had converted: the client that talks to the language model, two of its tests, the test runner's settings, and about twenty web app classes written in a style the strict rule forbids. Should this last step convert them itself?

## The decision, in plain words

This last step converted them itself, without changing what they do, so that no file is left unchecked and the web app follows the same strict rule as the rest. Nothing a person sees changes.

## The intro, for fun

The last box in the attic held four untyped files and twenty classes in old shoes.

## The punchline, for fun

Rather than leave a note for the next tenant, we unpacked it.

## The options, in plain words

A. A: s29 types the leftover files and rewrites the arcade classes, so every acceptance criterion on configs and @ts-nocheck holds (what I built)
B. B: leave them to a follow-up slice, and let the guard list them as known exceptions meanwhile
C. C: keep the arcade's erasable-syntax rule off for good, since its bundler compiles it, and type only the kit files

## What I had to decide

Who types kit/lib/openrouter.ts, openrouter.test.ts, config.test.ts and vitest.config.ts, which still opened with @ts-nocheck and sat in no slice's territory (settled items s3-05, s1-01), and who rewrites the arcade's 21 classes with parameter properties so the arcade can inherit erasableSyntaxOnly, as acceptance criterion 5 asks.

## What I did meanwhile

s29 typed the four files outside its territory. OpenRouter's JSON body, each streamed event and each thrown value are read through Zod schemas that never refuse: a field missing or of another shape reads as absent, as before (a non-string content now reads as empty instead of reaching parseJson). The arcade's tsconfig no longer sets erasableSyntaxOnly or noUncheckedIndexedAccess to false, nor allowJs; 21 classes (error classes, stores, fakes and test stubs) declare their fields and assign them in the constructor instead of using parameter properties. The casts in kit/lib/knowledge/pipeline.ts, apps/omni-app/src/canon/live.ts and apps/omni-app/src/retro/narrate.ts onto a hand-written AskModel type still compile; their ts-allow reasons, which say openrouter is untyped, are now stale and were left as written.

## What it costs to change later

Cheap: each change is behaviour-neutral and its own commit; reverting one restores @ts-nocheck or the parameter properties. Dropping the three stale askModel casts is a follow-up of a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the four files left with @ts-nocheck, nor the arcade's erasable-syntax rewrite
