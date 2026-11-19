---
id: s5-01-rule-139-way-back
prd: 3088
slice: s5
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-19
wave: 3
---

## The question, in plain words

The rule on when a mission sends a stopped PRD again said a PRD stopped on an Omni Loop bug stays stopped until a person steps in. Should the rule now say such a PRD comes back by itself once the fix is released and its repository runs it?

## The decision, in plain words

The rule now says it: once the fix is released and the repository runs that release or a later one, the PRD goes again without spending a repair. With an older kit it waits for the kit to be updated, a paused or stopped mission waits for its own Resume, and a bug closed as not planned leaves the PRD stopped.

## The intro, for fun

A rule that said wait for a person now also says wait for the release.

## The punchline, for fun

The person still gets the last word, it just arrives on the release train.

## The options, in plain words

A. Change the rule's text as the spec asks, and name the new tests that prove it (built).
B. Keep the rule's old text and record the way back as a new rule of its own.

## What I had to decide

Whether the rule's text changes as the spec asks, or the way back becomes a rule of its own. The spec says the rule's text is updated in the same change; the plan says a slice that changes this rule or its proofs records a high item naming it.

## What I did meanwhile

Changed the rule's text, added the PRD's spec to its sources and the two new test files to its proofs. The tests prove the PRD goes again on a kit at the fix's version, waits on an older or unreadable kit, waits for the mission's Resume while paused or stopped, and stays stopped on a bug closed as not planned.

## What it costs to change later

Going back to the old text is one paragraph; the behaviour would then need its own rule, or the code taken back out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rule is not locked, so no owner's approval is required on GitHub; this item is the person's chance to say no.
