---
id: s9-01-push-payload-shape
prd: 1322
slice: s9
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The phone receives a small message when someone is asked to approve. What should that message hold, so the phone can show it and open the right page when tapped?

## The decision, in plain words

The message holds a title, a line of text and the page to open, and a tap only ever opens a page on the Omni site. A message the phone cannot read still shows a short generic alert.

## The intro, for fun

A phone buzzes, and somebody has to agree on what the buzz says.

## The punchline, for fun

Title, a line, a link: the haiku of approval alerts.

## The options, in plain words

A. Send a title, one line and the page to open, and keep taps on the Omni site (what was built).
B. Send only the PRD number and let the phone build the text and the link itself.
C. Send the whole text with the problem and solution, as the email does.

## What I had to decide

Whether the phone's message is a title, one line and a page to open, which the sending side (slice s2) must follow.

## What I did meanwhile

The service worker reads JSON {title, body, url}; s2's Web Push sender must send that shape. A url off the site falls back to /app.

## What it costs to change later

A constant: renaming a field is one edit in the service worker (src/push/worker.ts) and one in s2's sender.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names what the notification reads but not the payload's shape between the sender and the service worker (author).
