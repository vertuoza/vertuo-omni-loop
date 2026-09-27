---
id: s6-03-share-card-for-every-page
prd: 261
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Should the ad's preview picture also show when someone shares a link to the game or to another page of the site?

## The decision, in plain words

Yes for now: every page of the site that has no picture of its own shows the ad's picture when shared. The link's own address is left out of the preview.

## The intro, for fun

One poster went up at the front door and the whole street got a copy.

## The punchline, for fun

Nobody complained yet, but the side doors never asked for it.

## The options, in plain words

A. The ad card for every page that has none, and no og:url, the option built.
B. Move the home page into a group of its own so only it carries the ad picture.
C. Fix the site's production address in the app and print each page's full address in the preview.

## What I had to decide

Next applies an `opengraph-image` at the app root to every route below it that has none of its own, and the slice's territory names only `apps/galaxy/app/opengraph-image`, so `/play`, `/ask`, `/knowledge`, `/app` and the others inherit the ad card. Separately, the app sets no `metadataBase`, so an `og:url` would print as a bare `/`.

## What I did meanwhile

Kept the card at `app/opengraph-image.tsx`: every page without its own shares with the ad card (their title and description are unchanged, from `app/layout.tsx`). Left `og:url` out of HOME's metadata; the image's address takes the deployment's origin from Next's fallback (VERCEL_PROJECT_PRODUCTION_URL on Vercel, localhost locally).

## What it costs to change later

Moving one file into a route group, or adding a card per page; setting `metadataBase` is one line once the production domain is settled.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the other pages should preview with a card of their own (author)
