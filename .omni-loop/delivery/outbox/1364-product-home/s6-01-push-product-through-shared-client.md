---
id: s6-01-push-product-through-shared-client
prd: 1364
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The product picked during a brainstorm needed one small change in a file outside the area agreed for this piece of work. Is that all right?

## The decision, in plain words

The product travels with the first upload through the kit's shared Omni page client, beside every other call to the page. The help text describes the new option in words and keeps its usage lines as they were.

## The intro, for fun

The product wanted a seat on the first upload, and the only bus leaves from the shared stop.

## The punchline, for fun

One more seat, same bus, same driver.

## The options, in plain words

A. Add the product to the shared client's upload call, and describe the option in the help text only
B. Give the dossier command its own signed-in upload call that carries the product
C. Add the option to the help usage lines too, changing the help table's own test

## What I had to decide

Whether pushDossier in kit/lib/ask/client.ts gains an optional product field (sent only when given), and whether --product joins the dossier usage lines in kit/lib/help/entries.ts, which kit/lib/help/entries.test.ts pins exactly.

## What I did meanwhile

kit/lib/ask/client.ts: pushDossier takes product and sends it only when set, as s4-03 and s5-01 did for the product calls. kit/lib/help/entries.ts: the dossier entry's detail describes --product <name>; its usage lines are unchanged, so entries.test.ts (outside this slice) still passes.

## What it costs to change later

A few lines: the field moves with the call; adding --product to the usage line is one string and the test's expected list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names neither kit/lib/ask/client.ts nor kit/lib/help/entries.test.ts in s6's territory; s4-03 and s5-01 settled the shared client for the other product calls.
