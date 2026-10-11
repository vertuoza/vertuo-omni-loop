---
id: s1-01-only-an-owner-sets-a-product-key
prd: 1548
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Who may give a product its short key, the word that starts every one of its PRD names, and can it ever change?

## The decision, in plain words

Only an owner of the workspace sets a product's key, once. After that nobody changes it, not even an owner, because every PRD name of that product is built from it.

## The intro, for fun

A product gets one short name tag for life, so someone has to hold the pen.

## The punchline, for fun

We handed the pen to the owners and glued the cap on.

## The options, in plain words

A. A. Only an owner sets a key, once (built).
B. B. Any member of the workspace sets it, once.
C. C. An owner may change it while the product has no PRD yet.

## What I had to decide

Confirm that setting a product's key is an owner's act, as changing a product's repositories is, rather than any member's, as renaming a product is.

## What I did meanwhile

product_set_key() calls product_repository_owned(), so a member who is no owner gets 42501. The key is checked against lowercase kebab-case (each part starting with a letter, at most 40 characters), unique in the workspace, and the products_key_once trigger refuses any change once set, even by the table owner.

## What it costs to change later

Widening it to any member is one line in product_set_key() (business_member_only instead of product_repository_owned). Letting a key change would orphan every product PRD id already handed out, so the set-once rule is the one to keep.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the key is set once on the product but not by whom; owner was the narrower choice.
- (author) No page sets a key yet: s2's push and later slices need one set, by an owner, before a product PRD exists.
