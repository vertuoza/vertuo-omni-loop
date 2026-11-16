---
id: s11-03-decision-names-and-trust-line-from-events
prd: 2896
slice: s11
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-16
wave: 11
---

## The question, in plain words

How does a person name the decision they overturn, and where do the lists and the trust line get their numbers?

## The decision, in plain words

A person names an approval by its PRD's number, and an answer by its PRD's number and the question's name. The lists and the trust line are both read from the mission's own record of decisions and overturns.

## The intro, for fun

Every decision gets a name tag.

## The punchline, for fun

The tag is a number, a slash and a word.

## The options, in plain words

A. Name by PRD number and item, read the lists from the events (built).
B. Give each decision an id of its own in a new table.

## What I had to decide

The spec leaves `<decision>` open. Answers have no row of their own, only an event, so a table id would have needed a new stored shape.

## What I did meanwhile

An overturn of the same decision twice is refused; a decision made again later (a new committee) stands on its own. Events written before this slice keep no verdicts: their lines read `every member who sat answered yes`.

## What it costs to change later

Option B adds a table and a migration; the pure reader in `kit/lib/mission/overturn.ts` is the one place that changes.

## What I could not know

(author) Whether a person would rather paste a decision's link than type its name.

- (author) Whether the tab itself should offer the overturn, beside the pull request's list: the screen's open question names it.
