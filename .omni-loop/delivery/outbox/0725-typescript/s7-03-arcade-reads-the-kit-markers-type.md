---
id: s7-03-arcade-reads-the-kit-markers-type
prd: 725
slice: s7
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Once the outbox comment code said exactly which markers it takes, one page of the web app stopped checking, because it described those markers as anything at all. Should this slice touch that page, which belongs to a later slice?

## The decision, in plain words

This slice changed that one line on the page to name the markers the tool really takes. Nothing the page shows changes.

## The intro, for fun

One page described its luggage as simply some kind of bag.

## The punchline, for fun

The airline now wants to know which bag, so the label got one more word.

## The options, in plain words

A. Change that one line here, so the whole repository keeps checking
B. Loosen the outbox comment code to accept any markers, and leave the page to its later slice
C. Leave the page failing its check until its later slice clears it

## What I had to decide

apps/galaxy/src/dossier/github/replies.ts declared `type Markers = object` and passed it to findPrMarkerComment and parseNumbersMarker, which s7 now types with the markers makeMarkers builds; tsc -p apps/galaxy failed on both calls. That folder is s26's territory (wave 5), outside s7's.

## What I did meanwhile

Changed that one alias to `Parameters<typeof findPrMarkerComment>[1]`, the kit's own markers type; its one caller (reader.ts) already passes config.markers, and pnpm typecheck passes with no other change. No runtime code changed.

## What it costs to change later

A constant: one type alias in one file; s26 may rewrite it when it clears the folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s26 would rather import the kit's markers type by name (author)
