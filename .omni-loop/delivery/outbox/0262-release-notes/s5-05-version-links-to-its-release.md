---
id: s5-05-version-links-to-its-release
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

Each release on the page has its own web address, so one release can be shared. Should its version number be a link to that address?

## The decision, in plain words

Yes: a click on a version puts that release's own address in the browser, ready to copy. The number of the product plan beside it stays plain text.

## The intro, for fun

Every release got its own address, and nobody told the visitor where to find it.

## The punchline, for fun

Now each version points at itself, the most modest link on the web.

## The options, in plain words

A. The version links to its own release, the address ready to copy: the option built.
B. No link: the address works, but a visitor has to know to type it.

## What I had to decide

The spec gives each release an anchor, its version (`/releases#0.0.3`), so one release can be shared, and says `PRD <n>` is never a link; it does not say how a visitor finds the anchor. The before/after page draws the version as a badge.

## What I did meanwhile

In `apps/galaxy/src/releases/page/ReleasesPage.tsx` the version badge is `<a href="#0.0.3">`, titled *Link to this release*, and a release opened by its anchor shows its badge filled (`:target` in `releases.css`). The PRD stays plain text, and a release holds no other link (`render.test.ts`).

## What it costs to change later

One element and two CSS rules. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether visitors expect a version badge to be clickable.
