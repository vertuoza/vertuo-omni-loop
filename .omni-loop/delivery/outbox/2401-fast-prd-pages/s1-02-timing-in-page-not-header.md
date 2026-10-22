---
id: s1-02-timing-in-page-not-header
prd: 2401
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A page in this app cannot add a header to its answer once it has begun to stream, so the timing of each read could not be sent as the Server-Timing header the spec names. Should it stay in the page?

## The decision, in plain words

Each read's name and duration is said in a hidden element at the end of the page, in the same Server-Timing format, and the measuring script reads it from there.

## The intro, for fun

A header must leave before the first byte, and the timings only exist after the last.

## The punchline, for fun

So they ride at the back of the page, like a receipt.

## The options, in plain words

A. A. A hidden template at the end of the page holds the Server-Timing value; the script reads it (built).
B. B. A real Server-Timing header, with each page rendered whole by a route handler, which gives up streaming.

## What I had to decide

Keep the hidden element at the end of the page, or move the timings to a real Server-Timing header through a route handler that renders the page without streaming.

## What I did meanwhile

Both pages carry the hidden element and perf-prd.ts reads it; no visible change.

## What it costs to change later

A real header would need both routes to stop streaming, or a route handler in front of each page: a larger change that would slow the pages the PRD speeds up.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Vercel deployment passes a trailing header to the browser was not tried (author).
