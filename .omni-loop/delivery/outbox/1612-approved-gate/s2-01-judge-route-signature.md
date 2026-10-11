---
id: s2-01-judge-route-signature
prd: 1612
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

How does the server know that a request for a PRD's approval really comes from our GitHub App, when that request carries no body to sign?

## The decision, in plain words

The App signs the address it asks for, the page and the PRD named in it, with the same shared secret it already uses for stage updates. A signature for one PRD cannot read another, and there is no clock in it.

## The intro, for fun

A letter with no body still needs a seal on its envelope.

## The punchline, for fun

So the App signs the address and trusts the postman with the rest.

## The options, in plain words

A. A. Sign the path and query exactly as sent, with the stage-event secret, no timestamp (built).
B. B. Also sign a timestamp header and refuse requests older than a few minutes.
C. C. Give the judge route its own secret, apart from the stage-event one.

## What I had to decide

Whether the App signs only the address it asks for, or also a timestamp so an old request expires.

## What I did meanwhile

The judge route accepts any request whose signature matches the path and query exactly as sent, under the stage-event secret; the App's check (s3) must sign the same string.

## What it costs to change later

Adding a timestamp later is one header on each side and one check here, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A replayed request only re-reads the same approval record a member already sees on the PRD's page; whether that is acceptable was not asked.
