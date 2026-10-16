---
id: s3-02-docs-api-guide-and-reference-share-a-page
prd: 2022
slice: s3
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

The written API guide and the interactive reference were both meant to live at the same address of the docs site, called API. Should that one page show both, the guide first and the reference under it?

## The decision, in plain words

The docs site's API page shows the written guide with the interactive reference under it, so neither hides the other.

## The intro, for fun

Two pages, one address: we made them share the sofa.

## The punchline, for fun

Nobody sits on the floor, for now.

## The options, in plain words

A. A. One API page with the guide, then the reference (built).
B. B. The reference alone on the API page, and the guide on a page of its own with another address.

## What I had to decide

A route file for the reference at app/docs/api would hide the guide page docs/guide/api.md, which the docs site serves at the very same address. So that route renders the guide page with the reference under it. Undoing it means giving one of them another address, a rename.

## What I did meanwhile

Both read at /docs/api, and the guide is the last link of the sidebar.

## What it costs to change later

One route file and one client component; a separate address is a rename.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Where the guide sits in the sidebar order was not specified (author).
