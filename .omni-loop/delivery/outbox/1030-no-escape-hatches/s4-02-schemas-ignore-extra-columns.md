---
id: s4-02-schemas-ignore-extra-columns
prd: 1030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When a database answer or a page's answer carries a field the program does not read, should the check refuse the whole answer, or keep only the fields it reads?

## The decision, in plain words

The checks in this slice keep only the fields they read and refuse a missing field, a wrong type or an empty value where none is allowed. An extra field is set aside, not refused.

## The intro, for fun

An answer that says a little more than asked is not usually lying.

## The punchline, for fun

So the checks listen to what they asked for and politely ignore the rest.

## The options, in plain words

A. A. Strip unknown keys, refuse the rest: the option built.
B. B. Refuse unknown keys too, and make the test fakes answer only the selected columns.
C. C. Refuse unknown keys on route answers only, where the fixtures are exact, and strip them on database rows.

## What I had to decide

Whether the zod schemas of the waiting list, the waiting outbox, the voice cast, the dossier's GitHub reads and the Send answers refuse unknown keys, or strip them.

## What I did meanwhile

Every schema in this slice is a plain zod object: a missing column, a wrong type and a forbidden null fail; an extra column is dropped. The existing test fakes answer whole rows whatever the select names, and they pass unchanged.

## What it costs to change later

Switching to refusing extra keys is one word per schema, plus making the test fakes answer only the selected columns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec's strict rule names a wrong type, a missing or renamed column and a forbidden null, and does not say whether an extra column fails
- (author) the sibling slices of this wave may have chosen the other way, so the wave may disagree with itself
