---
id: s1-01-sign-in-refusals
prd: 3007
slice: s1
rank: high
bears-on: ADR-0067
raised: 2026-11-17
wave: 1
---

## The question, in plain words

When an agent's sign-in cannot read a product's knowledge, how should the knowledge server say no?

## The decision, in plain words

A sign-in that is no longer valid is told so plainly, so the terminal renews it once by itself. A person who is not a member, or a product that is off or archived, gets the same 'nothing here' answer a working key gets, so nobody learns whether a product exists.

## The intro, for fun

Every door needs a polite way of saying no.

## The punchline, for fun

This one says it in two flavours, and never hints at what is behind it.

## The options, in plain words

A. As built: a sign-in that is no longer valid is refused so the terminal renews it once by itself; a person who is not a member, or a closed product, gets the 'nothing here' answer a working key gets.
B. Answer every refused sign-in the way a refused key is answered: the agent connects, and each search answers one line saying the sign-in does not work. The terminal then never renews on its own.
C. As built, but tell a valid sign-in of a person in none of the product's workspaces to ask to be added, at the price of saying the product exists.

## What I had to decide

Whether a refused sign-in answers like a refused key (a tool answer saying the key does not work) or like every other call of the terminal (a refusal the terminal renews its sign-in on).

## What I did meanwhile

The route answers 401 to a token the sign-in service refuses, 503 when that service cannot be reached, and 404 to a valid sign-in of a person who is not a member of the product's workspace now, or a product off, archived or unknown. Only a bearer shaped like a sign-in token (three dot-separated parts) goes to the sign-in service; any other bearer is checked as a key, exactly as before.

## What it costs to change later

A few lines in the route's controller and its tests; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a person who left is refused 'as a bad API key is'; a bad key answers a tool error, while a person who left now answers 404, as a working key of another workspace does: the route cannot tell 'left' from 'off' without saying whether the product exists.
- (author) The terminal's failure table (slice s2) then reads a person who left as 'This product's knowledge is off', which is not quite their case.
