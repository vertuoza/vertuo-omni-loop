---
id: s1-01-legal-source-free-text
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec says a Legal entry's source law is a link, but its own example is the name of a law and an article. Should the page insist on a web link?

## The decision, in plain words

Any one line of up to 500 characters is accepted as the source law, a link or the law's name, so the spec's own example fits.

## The intro, for fun

A law can live at a web address or on page 53 of a thick book.

## The punchline, for fun

We took both, and the book did not complain.

## The options, in plain words

A. Any one line: a link or the name and article of the law.
B. Only a web address starting with http:// or https://.

## What I had to decide

Answer A to keep the free line, or B to accept only a web address.

## What I did meanwhile

The database takes any one line of text as the source; nothing checks that it is a web address.

## What it costs to change later

Requiring a link later is one changed check in a new migration; entries already stored without a link would then need editing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the people who write Legal entries keep their sources online or cite printed codes (author)
