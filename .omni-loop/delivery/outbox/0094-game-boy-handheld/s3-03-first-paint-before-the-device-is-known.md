---
id: s3-03-first-paint-before-the-device-is-known
prd: 94
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The server cannot tell a phone from a computer, so the page first arrives drawn one way and changes once it starts in the browser. Which way should it arrive?

## The decision, in plain words

It arrives as the computer view, the screen alone, and a phone changes to the Game Boy a moment later, as soon as the page starts.

## The intro, for fun

Every console needs a second to find out who is holding it.

## The punchline, for fun

Until then it politely assumes you brought a keyboard.

## The options, in plain words

A. Arrive as the computer view, and change on a phone once the page starts. This is what was built.
B. Arrive as the upright Game Boy, and change on a computer once the page starts.
C. Arrive as a plain dark page, and draw the right body once the page starts.

## What I had to decide

`formFor()` needs the pointer and the viewport, which only the browser knows, and the arcade's page is rendered on the server. The spec does not say what shows before the arcade starts in the browser.

## What I did meanwhile

`useForm()` in `apps/galaxy/src/arcade/form.ts` gives the server `full`, and React switches to the device's form right after hydration. On a phone on a slow connection, the screen alone shows until the scripts run, as the cabinet showed its screen unfitted until then.

## What it costs to change later

A constant: the server snapshot in `useForm()`. A first paint drawn by CSS alone, from the pointer and the orientation media queries, is a larger change to `shell.css` and `ArcadeApp.tsx`, still with no data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long a phone shows the first view on a real connection: measured only on the local dev server.
