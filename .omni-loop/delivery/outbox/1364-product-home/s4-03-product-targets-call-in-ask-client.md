---
id: s4-03-product-targets-call-in-ask-client
prd: 1364
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Where should the kit's call that reads a product's targets from the Omni page live?

## The decision, in plain words

It is one more call on the kit's existing Omni page client, beside the other calls, so it shares the sign-in and its renewal. That file is outside this slice's agreed area.

## The intro, for fun

The new call needed a phone, and the only phone in the house sits in the hallway.

## The punchline, for fun

So it borrowed the hallway, one line long.

## The options, in plain words

A. Keep the call on the shared Omni page client, as every other Omni page call is.
B. Move it into the kit's new product module with its own signed-in request, leaving the shared client untouched.
C. Give the shared client one general signed-in read, and build the product calls on it in the product module.

## What I had to decide

Whether readProductTargets stays on the shared ask client (kit/lib/ask/client.ts) or moves into kit/lib/product/ with its own authorized request.

## What I did meanwhile

kit/lib/ask/client.ts gains readProductTargets({ repo, product }), a GET of /api/products/targets; kit/lib/product/targets.ts takes it as a plain function, so moving it later changes one import.

## What it costs to change later

Moving it is a few lines; a copy in kit/lib/product/ would duplicate the token refresh the client already does.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s5 (omni product import) will need a write call too, and its territory does not name the client either. (author)
