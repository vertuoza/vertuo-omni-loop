---
id: s1-01-exchange-lease
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When two cloud sessions use the same token at the same moment, the plan says the second one waits for the first. The database cannot hold a lock across the two calls the server makes, so how should the second one wait?

## The decision, in plain words

The first session takes a short hold on the token, at most thirty seconds. The second sees it is held, waits a quarter of a second, and asks again, up to ten seconds, then says to try again.

## The intro, for fun

Two cloud sessions reach for the same token at once, and only one may hold it.

## The punchline, for fun

The second one waits politely at the door, and gives up after ten seconds.

## The options, in plain words

A. A. A thirty-second hold taken by the first exchange; the second waits and claims again, up to ten seconds (built)
B. B. A database function that does the whole exchange in one call, with the session renewed from inside the database
C. C. No waiting: the second exchange is refused at once and the kit retries

## What I had to decide

Keep the thirty-second hold the exchange takes on the token, or ask for a different way to put two exchanges one after the other.

## What I did meanwhile

Two exchanges at once renew one after the other; one that never comes back blocks the token for thirty seconds at most.

## What it costs to change later

Changing the wait is a constant in galaxy; dropping the hold for something else is a follow-up migration that drops two columns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not measured against the hosted database: how long a renewal takes there (author)
- If the server crashes after Auth renewed the session but before it was written back, the stored session is lost and the token stops working; the person makes a new one (author)
