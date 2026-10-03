---
id: s3-01-business-reads-the-check-cannot-run
prd: 1030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check may only read, but three of the business page's calls write or need a signed-in member. How are they checked against real rows?

## The decision, in plain words

Those three are left out of the check and named here. Every other business read is checked, and the rows the saving calls answer are checked by reading the same tables whole.

## The intro, for fun

Some calls cannot be watched without changing what they watch.

## The punchline, for fun

So they sit this one out, with a note from the teacher.

## The options, in plain words

A. A. Leave the three out and check the saving calls' answers through their tables: the option built.
B. B. Split the business opening into a read and a separate create, so the read can be checked, at the price of a migration this feature rules out.
C. C. Run the check as a signed-in test member too, so the members list can be read, which needs a member account in every database the check runs against.

## What I had to decide

Whether the business reads that cannot run as a plain read are left out of the database check, or reworked so they can be checked.

## What I did meanwhile

The opening of the business (it creates the business the first time), the members list (only a signed-in member may run it, never the service key) and the evidence proposal (it writes) are not registered. The answers of the saving calls (a claim, a product, a persona, a draft, a web page) are checked by reading each table whole with the same schema, since each call answers one whole row of it.

## What it costs to change later

One boundary line each, if a later change makes one of the three readable without writing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the members list is read the same way by the people directory, outside this slice, which will meet the same limit
- (author) a whole-table read proves the stored rows parse, not that a saving call answers exactly a stored row
