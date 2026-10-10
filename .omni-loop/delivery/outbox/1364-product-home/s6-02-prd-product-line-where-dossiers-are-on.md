---
id: s6-02-prd-product-line-where-dossiers-are-on
prd: 1364
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The PRD lookup now shows a PRD's product. Should it show one in a repository that never sends its PRDs to the Omni page, and what should it say when the page cannot answer?

## The decision, in plain words

The product shows as the lookup's last line only where PRDs go to the Omni page, since that is where a product lives. When the page cannot answer, the line says the product is unknown and why, and the lookup still succeeds.

## The intro, for fun

Asking a PRD which product it belongs to is easy, unless it never met the page that knows.

## The punchline, for fun

So it only answers where the page can hear the question.

## The options, in plain words

A. Show the product line only where PRDs go to the Omni page, last, with unknown and the reason when the page cannot answer
B. Always show a product line, none where PRDs do not go to the Omni page
C. Show the product line right after the state line

## What I had to decide

Whether omni prd <n> prints product: none or nothing where dossier.enabled is false or ask.url is unset; where the line goes; and what it prints when the lookup fails (no sign-in, unreachable, refused).

## What I did meanwhile

kit/lib/dossier/product.ts: productLine() returns null where dossierSwitch() is off (no call is made), else product: <name> | none (404 reads none) | unknown (<why>). kit/bin/commands/prd.ts appends it after every other line; the exit is unchanged. kit/bin/prd.test.ts and every fixture without dossiers keep their exact output.

## What it costs to change later

A constant: printing product: none where dossiers are off, or moving the line, is one condition in kit/lib/dossier/product.ts and kit/bin/commands/prd.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says omni prd prints product: <name> or product: none, and says nothing of a repository with dossiers off, of an unreachable page, or of where the line goes.
