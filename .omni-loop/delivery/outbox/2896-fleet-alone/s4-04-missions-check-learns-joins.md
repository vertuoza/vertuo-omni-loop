---
id: s4-04-missions-check-learns-joins
prd: 2896
slice: s4
rank: high
bears-on: BR-PRODUCT-138
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The database check that proves the product's rules for missions was changed so it also expects a PRD joining its mission's branch. Do you accept this change to the rule check?

## The decision, in plain words

The check was extended, not loosened: every old expectation still holds, the list of event kinds grows from twelve to thirteen, and a member now also reads a join event. The service role still writes every event and a member still writes none.

## The intro, for fun

The mission's diary learned one new word: joined.

## The punchline, for fun

Nobody tore out a page; the diary just got one more line.

## The options, in plain words

A. A. Accept the changed check, extended to cover a PRD joining the branch (built).
B. B. Undo it, and keep joins out of the mission's events.

## What I had to decide

Accept the changed check as built, or undo it and record joins in a way the old check accepts unchanged.

## What I did meanwhile

The check passes as changed, run against a local database with this PRD's migrations, and fails without this slice's migration.

## What it costs to change later

Undoing it means dropping the join event, which every later slice of this PRD reads to know what is on the mission branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rules this check proves are proposed, not confirmed: no owner is named to approve them.
- (author) Raised high because a change to a rule's proof is a person's to accept; the kit ranks it medium on its own, as for PRD 2871.
