---
id: s11-01-a-product-run-outside-a-plan-repository
prd: 1548
slice: s11
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Run from an ordinary repository rather than a plan repository, the brainstorm cannot list the product's repositories by its short key, and the plan grader only reads a PRD kept in a repository. How does a product run cope?

## The decision, in plain words

The repositories come from the design: the person names each one, as the design already asks. The plan is written as always but not graded, and the hand-off says so.

## The intro, for fun

The brainstorm moved out of its office and left its address book behind.

## The punchline, for fun

It asks the person for each address, and admits it skipped the spell check.

## The options, in plain words

A. Targets from the design and plan check not run, said in the hand-off (built).
B. Teach omni targets and omni plan check a product PRD in this landing first.
C. Run a product brainstorm only from a checkout whose config says plan.product.

## What I had to decide

Confirm the product run's two gaps until a later slice closes them: outside a config with plan.product, the targets are the repositories the design names (the products/targets route reads a product by name, not by key); and omni plan check, which reads a PRD by number from the delivery tree, is reported as not run on a product PRD.

## What I did meanwhile

kit/plugin/skills/mega-brainstorm/SKILL.md, From a product: step 1 reads omni targets --json when plan.product is set and otherwise takes the repositories the design names; every one is checked with omni product phase0 before any clone. The plan is written into the scratch PRD folder and pushed with omni dossier push <key>-<n> --from, and the hand-off names plan check as not run.

## What it costs to change later

Teaching the targets route a key, and plan check a folder or a product PRD id, are each a change in one route or command; the skill's text then drops the fallback.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s12 takes plans through omni dossier get; whether it grades them there is s12's to say.
