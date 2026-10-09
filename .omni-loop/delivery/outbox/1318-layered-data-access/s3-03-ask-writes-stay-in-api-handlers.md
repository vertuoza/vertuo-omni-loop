---
id: s3-03-ask-writes-stay-in-api-handlers
prd: 1318
slice: s3
rank: high
bears-on: ADR-0095
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The plan asks the ask actions the page and the terminal share to go through the new layered files, but they already live in one tested place that answers the terminal in its own words. Should they be split into the new layers now?

## The decision, in plain words

The shared actions stay where they were, in one place that checks who is calling and then acts, and keep answering in the words the terminal already reads. The page now goes through them too; only their database calls moved into the layer that reaches the database.

## The intro, for fun

Two front doors were about to get one shared hallway.

## The punchline, for fun

The hallway works; nobody repainted it yet.

## The options, in plain words

A. As built: the shared actions stay in their one module, now taking the page's sign-in too, and keep their plain-words refusals.
B. Split them now into a controller and a service, keeping the plain-words refusals the terminal reads.
C. Split them and move every refusal to the contract's short kinds, changing the terminal to read those.

## What I had to decide

Whether the shared write routes under /api/ask/* move from src/ask/api.ts (one module that checks the caller, holds the rules and calls the repository) into ask.controller.ts and ask.service.ts, and whether their refusals switch to the contract's {error: <kind>} shape. They stay in api.ts with their plain-words {error} bodies, which the kit's omni ask reads; the browser's client reads them by status. The layering guard does not name api.ts a controller or a service, so it passes, and its database calls now sit in ask.repository.ts.

## What I did meanwhile

src/ask/api.ts takes the cookie session as well as the bearer token (AskDeps.cookie); src/ask/ask.client.ts maps 401, 403, 404 and 409 by status. The read routes of s2 and the new way-back route answer the contract's kinds.

## What it costs to change later

Splitting api.ts later is a move of its handlers into a controller and a service, with the same tests (src/ask/api.test.ts); changing the error bodies also changes the kit's ask client, which prints them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the shared controllers call ask.service.ts and that errors have one shape, but the terminal prints the plain-words error the routes answer today, and the plan's done-when asks only that both sign-ins are accepted.
