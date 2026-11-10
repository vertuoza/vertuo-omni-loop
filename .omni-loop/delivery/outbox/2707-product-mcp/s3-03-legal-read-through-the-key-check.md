---
id: s3-03-legal-read-through-the-key-check
prd: 2707
slice: s3
rank: medium
bears-on: none
raised: 2026-11-10
wave: 2
---

## The question, in plain words

This slice changed the database function and its check that another slice built, so the server reads Legal entries and their owners the same way the agent link does. Is that the right home for it?

## The decision, in plain words

The function that checks the key now also answers the product's Legal entries, with each owner's GitHub name, and its Glossary, read exactly as the agent link reads them. The server no longer reads those tables or the owner's name itself, because it was not allowed to, and the fallback could have shown an email.

## The intro, for fun

The server knocked on a door it had no key to, and nobody heard it.

## The punchline, for fun

So the database now hands the Legal entries over with the key check itself.

## The options, in plain words

A. A. The key check answers the Legal entries and the Glossary as the agent link reads them, and the server reads only the Never lines itself (built).
B. B. Add a separate database function, the service role's only, that answers a product's Legal entries and Glossary, and leave the key check as it was.

## What I had to decide

Whether the key check may carry the product's Legal entries and Glossary, so the server never reads an owner's name on its own.

## What I did meanwhile

Every Legal entry the server answers names its owner the way the agent link names them, and only for a key that reaches the product.

## What it costs to change later

A constant while the feature is unmerged: one key of the function's answer and the lines that read it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- This slice's territory did not hold the migration or its check: the wave will report the change as a territory breach (author).
- The owner's name falls back to an email when the person has no player and no GitHub identity, exactly as the agent link already does; this change neither adds nor removes that (author).
