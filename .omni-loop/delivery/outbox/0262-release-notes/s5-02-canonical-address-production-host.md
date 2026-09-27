---
id: s5-02-canonical-address-production-host
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

Search engines and link previews are told one official web address for the release notes page. Which address should that be?

## The decision, in plain words

The app's current public address, written once in the page, so every copy of the page, preview copies included, sends search engines to the same place.

## The intro, for fun

Every page wants one true address, even when a dozen preview copies serve it.

## The punchline, for fun

The page now points home, and moving home later is a one-line change.

## The options, in plain words

A. The app's current public address, written once in the page: the option built.
B. The address the hosting service reports as the production one, read when the page is built, the written address as a fallback.
C. No official address: search engines pick whichever copy they find.

## What I had to decide

The spec asks for a canonical address and Open Graph tags on `/releases` and does not name the host. Next needs an absolute URL for both, and the app sets no `metadataBase` anywhere.

## What I did meanwhile

`SITE = 'https://vertuo-omni-loop-galaxy.vercel.app'` in `apps/galaxy/src/releases/page/address.ts`: the default of `signature.home` and this repository's `ask.url`. The canonical and `og:url` are `<SITE>/releases` (`apps/galaxy/src/releases/page/render.test.ts`), checked in the dev server's HTML.

## What it costs to change later

One constant and its test line; a custom domain later changes the constant. Search engines re-read the canonical at their next crawl. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a custom domain is planned for the app, which would leave the written address pointing at the old one.
