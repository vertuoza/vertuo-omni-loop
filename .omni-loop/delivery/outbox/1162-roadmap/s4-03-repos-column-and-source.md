---
id: s4-03-repos-column-and-source
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

How strict is the roadmap file about which repositories each project names, and about saying where the roadmap came from?

## The decision, in plain words

In a plan repository every project must name at least one repository; outside one, a repositories column is refused. Saying where the roadmap was read from is optional, like the product and the target date.

## The intro, for fun

Every roadmap starts somewhere, but not every start has a link.

## The punchline, for fun

Pasted text gets to stay anonymous.

## The options, in plain words

A. A. Repositories required on every row of a plan repository; source optional (built).
B. B. Source required too, written as pasted for pasted text.
C. C. Repositories optional per row, a row without them read as the plan repository's own.

## What I had to decide

Whether the source line is required, and whether a plan repository's roadmap may leave a project's repositories empty.

## What I did meanwhile

A plan repository's roadmap needs its repositories column and a repository on every row; the source line may be left out.

## What it costs to change later

Making the source required, or relaxing the repositories rule, is one schema field or one condition and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists source beside the optional fields without saying it is optional; a roadmap from pasted text has no link to give (author).
