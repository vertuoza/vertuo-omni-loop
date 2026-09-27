---
id: s2-04-tab-and-version-in-address
prd: 216
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The PRD's page has a tab per artifact and a version picker. Where should the chosen tab and version be kept, and which tab should open first?

## The decision, in plain words

They are kept in the page's address, so every view is a link that can be shared and the page works before any script runs. The before-and-after page opens first, since it is what a product owner comes for.

## The intro, for fun

The tabs were asked where they live, and each one answered with its full address.

## The punchline, for fun

Share the link, and the reader lands on the very same version of the very same tab.

## The options, in plain words

A. In the address, with the before-and-after page first
B. In the address, with the spec first
C. In the page only, so the address never changes

## What I had to decide

Keep the tab and the version in the address or only in the page, and pick the tab that opens first.

## What I did meanwhile

The address carries the tab and the version; with neither, the page opens the before/after tab at its latest version. The picker is a form that sends its choice to the same address.

## What it costs to change later

A constant and the page's links; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the tabs in an order but does not say which one opens first.
