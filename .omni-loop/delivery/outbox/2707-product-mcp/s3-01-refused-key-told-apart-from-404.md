---
id: s3-01-refused-key-told-apart-from-404
prd: 2707
slice: s3
rank: medium
bears-on: none
raised: 2026-11-10
wave: 2
---

## The question, in plain words

When the server's check answers nothing, how do we tell a key that does not work from a product that is off or out of the key's reach?

## The decision, in plain words

When the check answers nothing, the server asks once more whether the key itself works. A key that does not work connects and gets the one line on each call; a working key for a product it cannot read gets the same not-found answer for every such product.

## The intro, for fun

Two kinds of no came back from the database looking exactly alike.

## The punchline, for fun

So the server asks the key one more question before it picks which no to say.

## The options, in plain words

A. A. Ask whether the key works when the check answers nothing: a dead key gets the one line, a working key gets not-found (built).
B. B. Answer not-found for every request the check refuses, whatever the key, and drop the one line on this server.
C. C. Answer the one line for every refusal, so a product that is off connects too.

## What I had to decide

Whether a working key for a product that is off or out of its reach gets not-found, and a key that does not work at all gets the one line.

## What I did meanwhile

A key that does not work connects and answers the one line on every call; a working key gets not-found for a product it cannot read.

## What it costs to change later

A constant: one extra read of the key, only when the main check answers nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A key of another workspace is a working key, so it gets not-found too, as the spec asks; no test against a real database proves the extra read, only the stubbed one (author).
