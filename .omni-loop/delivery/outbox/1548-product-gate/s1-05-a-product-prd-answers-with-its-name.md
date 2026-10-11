---
id: s1-05-a-product-prd-answers-with-its-name
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the server answers about a product PRD, which has no repository and no repository number, what does it say in their place?

## The decision, in plain words

It leaves the repository and the number empty and adds the PRD's own name, like mobile-12. Answers about a PRD of a repository stay exactly as they were.

## The intro, for fun

A PRD with no home address still needs something written on the envelope.

## The punchline, for fun

We wrote its full name and left the street blank.

## The options, in plain words

A. A. Empty repository and number, plus the PRD's name, for a product PRD only (built).
B. B. Always answer the PRD's name, for every PRD, as text.
C. C. Answer the product's key and the number as two fields.

## What I had to decide

Confirm the answer shape the kit and the apps read in s2 and s3: repo and prd null, and prdId `<key>-<n>`, added only for a product PRD.

## What I did meanwhile

dossier_push(), dossier_approve() and approval_request() append prdId for a product PRD only, so every existing answer, and every existing check comparing one whole, is unchanged. dossier_approval() answers as before. Readers that parse repo as text will refuse a product PRD's answer until s2 and s3 teach them the new shape.

## What it costs to change later

Renaming or reshaping the field is a change in three function bodies and their readers, before any product PRD exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the RPCs take either key but not what they answer about a product PRD.
