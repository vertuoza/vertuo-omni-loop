---
id: s4-03-frame-waits-for-the-bell
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The frame around every page, the sidebar and the top bar, still waits for the count of questions waiting for you before it is sent. Should that count arrive on its own instead, after the frame?

## The decision, in plain words

The frame still reads the count first: it is one quick read, shared with the page, and since clicks no longer reload the whole page it is read once per visit. Every slow part of the pages themselves now arrives on its own.

## The intro, for fun

The front door opens fast, but the doorman still counts your letters first.

## The punchline, for fun

He counts quickly, and he only does it when you walk in from the street.

## The options, in plain words

A. Keep reading the count before the frame (built).
B. Send the frame without the count, and let the bell fill in right after, in its own block or from the browser's first poll.

## What I had to decide

Whether the layouts (app/app/layout.tsx, app/prd/layout.tsx) send the frame before the waiting questions are read. viewerLive() in src/nav/viewer.ts reads the claims, the workspace and the questions before AppShell renders; streaming the bell apart means changing src/nav, which is outside s4's territory.

## What I did meanwhile

The layouts are unchanged: they await viewerLive(). Every route's loading.tsx sits inside the layout, so its skeleton is sent as soon as the layout's reads are done, and the page's heavy blocks stream after it.

## What it costs to change later

A change in the frame's code later, no stored data and no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the frame's reads keep the first paint under 200 ms on production is not measured: the timings run after merge will tell.
