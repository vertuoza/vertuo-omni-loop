---
id: s9-03-service-worker-address
prd: 1322
slice: s9
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec puts the small background program that receives phone alerts at the site's root address. This repository allows no hand-written script files, so where should that program be served from?

## The decision, in plain words

The program is served by the app from an address under its alert routes, and it is allowed to cover the whole site, so phone alerts work exactly as the spec describes.

## The intro, for fun

The spec booked a room at the front door, but the house rules ban the furniture.

## The punchline, for fun

So the program moved in through the side door and still got the master key.

## The options, in plain words

A. Serve the worker from the alert routes, allowed the whole site (what was built).
B. Serve it at the site's root through a rewrite, which a later slice adds outside this one's ground.
C. Allow one hand-written script file in the public folder, as an exception to the guard.

## What I had to decide

Whether the service worker is served at /api/push/sw.js with scope '/' instead of a static /sw.js.

## What I did meanwhile

GET /api/push/sw.js serves the worker's source (src/push/worker.ts) with Service-Worker-Allowed: /, and the switch registers it with scope '/'. The typescript guard refuses a JavaScript source file such as public/sw.js, and the plan's territory has no route at /sw.js.

## What it costs to change later

A constant: moving it to /sw.js later is a route or a rewrite, and the path the switch registers; browsers keep the old worker until it is unregistered or replaced.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec and the plan name /sw.js, a static file the repository's typescript guard refuses (author).
