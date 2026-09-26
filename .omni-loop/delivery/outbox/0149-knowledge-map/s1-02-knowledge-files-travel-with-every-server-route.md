---
id: s1-02-knowledge-files-travel-with-every-server-route
prd: 149
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

A deployment of the web app must carry the knowledge files so both maps can read them. Should the files go only with the arcade and the knowledge page, or with every page the server renders?

## The decision, in plain words

They go with every page the server renders: the web framework matches page addresses loosely and cannot single out the home page. The files are a few kilobytes and are never sent to a browser.

## The intro, for fun

Packing the map in every suitcase is a little heavier, but nobody arrives without one.

## The punchline, for fun

A few kilobytes of extra luggage, and not one lost bag.

## The options, in plain words

A. Carry the knowledge files with every page the server renders, the option built.
B. Carry them only with the knowledge page, and let the arcade fetch its map from that page's address.

## What I had to decide

The plan says `next.config.mjs` traces the knowledge files for both routes up front. Next matches `outputFileTracingIncludes` keys with picomatch and `contains: true` (`node_modules/next/dist/build/collect-build-traces.js`), so the key `/` matches every route and no glob matches the home route alone.

## What I did meanwhile

One key, `'/'`, carries `.omni-loop/config.yml` and the registers under `product/`, `domains/` and `cross-domain/` (not the playbook, not the decision records) into every server function's trace, the arcade's `/` and the future `/knowledge` among them. On a local `pnpm galaxy:build`, the traces of `/`, an ask API route and a throwaway probe route calling the loader each list the four files, and the probe answered 58 entries and 26 links under `next start` (the probe was not committed). The loader's one request-time path carries `turbopackIgnore`: without it Turbopack warned that it would trace the whole repository into the route.

## What it costs to change later

Narrowing it later is a one-line change in `apps/galaxy/next.config.mjs`, or moving the graph behind its own route prefix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a Vercel function runs from the app's folder inside the traced tree, which the loader relies on to find the config by walking up; only a deployment shows it, and if not, both maps say the knowledge is out of reach.
