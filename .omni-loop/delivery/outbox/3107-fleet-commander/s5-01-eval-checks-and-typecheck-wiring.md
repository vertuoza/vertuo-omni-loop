---
id: s5-01-eval-checks-and-typecheck-wiring
prd: 3107
slice: s5
rank: medium
bears-on: none
raised: 2026-11-20
wave: 5
---

## The question, in plain words

How should the Commander's evals check that a claim is backed by its record, and where should the eval script be type-checked?

## The decision, in plain words

A claim counts as backed when its numbers and half its words appear in the record it cites, and a sample is printed for a person to check. The script is checked for errors with the arcade project instead of the root one.

## The intro, for fun

The oracle's homework needs marking, and the marker is a small robot with a word list.

## The punchline, for fun

A person still spot-checks the ten answers it printed.

## The options, in plain words

A. A. As built: a word-and-number overlap check, the script type-checked with the arcade's project.
B. B. Ask the model itself to grade each claim, which spends more tokens and trusts the model to mark its own work.
C. C. Leave support to the person's sample alone, with no automatic rate.

## What I had to decide

Claims supported is a word-overlap proxy, not a judgement of meaning, because the spec asks for a sample checked by a person on top of the 95% bar. The script imports the arcade's extensionless sources, so the root typecheck cannot follow them: its folder is excluded from tsconfig.json, gets its own tsconfig that extends the arcade's, and is included in apps/galaxy/tsconfig.json, two config files outside the slice's territory. The command bundles the script with esbuild before running it, for the same reason.

## What I did meanwhile

Nothing is lost: the evals, their fake-model tests and the typecheck all run, the real model is never called here, and each check is one function that can be tightened later.

## What it costs to change later

Low: a stricter support check is one function in the script, and the two config lines move back with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say how a claim's support is judged by a program, only that a person checks a sample.
