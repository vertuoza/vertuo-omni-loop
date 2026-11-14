---
id: s1-03-review-form-budget
prd: 2871
slice: s1
rank: high
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

The review page every agent may read grew from about one kilobyte to about two, because it now lists the six things the Reviewer looks for. May its size limit go up to two kilobytes?

## The decision, in plain words

This step raised the limit to two kilobytes, since the six items cannot fit in the seventy bytes left under the old limit without losing what each one asks for.

## The intro, for fun

The review page packed six new things to look for and outgrew its suitcase.

## The punchline, for fun

A bigger suitcase is on order, pending one person's signature.

## The options, in plain words

A. A. Raise the review page's limit to two kilobytes, the six items kept on it (built).
B. B. Keep the one-kilobyte limit, and cut the six items from the page down to a single line that points to the review command.

## What I had to decide

The context budget measures what `omni kb show review` prints: 955 bytes before this slice against a 1024-byte ceiling. The spec asks the kit default of the review form's new look-for section to hold six items in order of harm, each with what it covers; printed, that section is 981 bytes, bringing the form to 1936 bytes. Trimming cannot fit it: the heading alone takes 27 of the 69 bytes left, and the fix, push-back and ask sections are not this slice's to cut. So the ceiling of form:review in .omni-loop/budgets/context.json went from 1024 to 2048 bytes, the measured size rounded up to the next KiB.

Budget raise: `form:review` to 2048 bytes

## What I did meanwhile

Raised the ceiling in the same commit as this item; check context stays red until a person answers.

## What it costs to change later

A constant: putting the ceiling back is one number, and then the look-for default must shrink to a pointer or leave the form.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the look-for list would rather live only behind the review command, out of the page every agent reads, which the spec does not allow as written.
