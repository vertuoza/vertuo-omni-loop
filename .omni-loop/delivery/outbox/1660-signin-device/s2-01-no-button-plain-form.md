---
id: s2-01-no-button-plain-form
prd: 1660
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When someone presses No on the code check page, how should the page tell the server, and should it refuse a press that comes from another website?

## The decision, in plain words

No sends a plain form to the page's own address, which works without any script, and accepts it from anywhere: a press only refuses a sign-in nobody approved yet, and needs a code that lives ten minutes.

## The intro, for fun

Somebody pressed No, and the server has to believe them.

## The punchline, for fun

A stranger who guesses the code can only cancel a sign-in nobody wanted yet.

## The options, in plain words

A. A plain form to the page's own address, accepted from any origin
B. The same form, refused when the browser says it came from another site

## What I had to decide

Keep No as a plain form open to any origin (A), or add a same-site check to it (B).

## What I did meanwhile

Built as A: the page's No button posts the code to /ask/device/deny, which marks the pending request denied and sends the browser to Nothing was signed in (src/ask/device-card.controller.ts).

## What it costs to change later

B is a header check in denyDevice and one test, at any time, with nothing stored to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says No marks the request denied without saying how the page reaches the server. (author)
