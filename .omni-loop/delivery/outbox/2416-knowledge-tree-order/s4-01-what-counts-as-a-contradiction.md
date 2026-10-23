---
id: s4-01-what-counts-as-a-contradiction
prd: 2416
slice: s4
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

When does a product rule written in a repository count as contradicting a rule of the levels above it, so that the knowledge check turns red?

## The decision, in plain words

Only when the repository reuses the number of a rule from above and changes what it says, or what sort of entry it is. A rule under a number of its own only adds and stays green; one that repeats the rule above word for word is fine too.

## The intro, for fun

Family rules: you can add your own, but you cannot rewrite grandma's.

## The punchline, for fun

Same name, different story, and the check calls it out.

## The options, in plain words

A. A. Same number with different words or a different sort of entry, while a repeat or a new number stays green: the option built.
B. B. Also flag a rule under a new number whose wording matches a higher rule's closely but says the opposite, judged by a language model.
C. C. Ask the person writing a rule to mark it with a line naming the higher rule it overrides or contradicts, and flag only those marked rules.

## What I had to decide

What counts as a contradiction between two levels' register entries, read from the registers' own fields only. Built (kit/lib/knowledge-tree/product.ts, wired into gradeKnowledge in kit/lib/knowledge/check-knowledge.ts): a lower level's entry carrying the id of a higher level's entry contradicts it when its kind differs, or else its statement differs once spacing is collapsed. Each pair is one red line naming both entries, their files and their levels, and what differs. Every pair is checked, the plan repository's copy against the Omni settings' copy as well as the repository against either, since the spec says a lower level never contradicts a higher one. Other fields (Serves, Enforced by, Locked, Governs, Proposed) are not compared: they say how a level proves or governs a rule, not what the rule is. A proposed higher entry counts like a confirmed one. An imported copy (ctx.copyOf) is never compared.

## What I did meanwhile

The check is one function over the parsed entries and one call in the grade; a repository with no level above it grades exactly as before.

## What it costs to change later

A different definition is a change to one comparison function and its tests; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether two repositories numbering their product rules independently can collide on an id with no intent to restate, which this definition reads as a contradiction
- (author) whether a contradiction between the plan repository's copy and the Omni settings' copy should turn this repository's check red, since neither copy is this repository's to fix
- (author) whether a higher entry still only proposed should bind the levels under it
