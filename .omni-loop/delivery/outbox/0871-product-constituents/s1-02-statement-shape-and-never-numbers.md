---
id: s1-02-statement-shape-and-never-numbers
prd: 871
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The spec does not say how long a product's Statement may be, whether it can be removed, or whether Never line numbers count per product or per workspace.

## The decision, in plain words

A Statement is one line of up to 400 characters, an owner can remove it and write a new one, and Never line numbers count per product, so each product starts at number one.

## The intro, for fun

Every product gets one sentence about who it is, like a dating profile but stricter.

## The punchline, for fun

Four hundred characters, one line, no novels.

## The options, in plain words

A. A. One line up to 400 characters, removable, Never numbers per product.
B. B. Allow several lines in the Statement, up to 1000 characters.
C. C. Count Never numbers across the whole workspace instead of per product.

## What I had to decide

Confirm the Statement length and the per product numbering, or pick other limits.

## What I did meanwhile

Owners type Statements up to 400 characters on one line, and each product numbers its own Never lines from one.

## What it costs to change later

Changing the length is one small database change; renumbering Never lines after people cite them would be costly.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the spec or the knowledge base sets a Statement length; 400 is my pick from the proposed Statements, which run about 150 characters. (author)
