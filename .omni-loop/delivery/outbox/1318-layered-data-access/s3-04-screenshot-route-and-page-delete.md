---
id: s3-04-screenshot-route-and-page-delete
prd: 1318
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

Screenshots now go to the server one at a time before the answer, and deleting a session from the page now goes through the terminal's delete. At which address do screenshots go, and what does that delete do with them?

## The decision, in plain words

Each screenshot is sent to its own address under its question, and a dropped one is deleted there. Deleting a session from the page now removes its screenshots too, as the terminal's delete always did, and fails rather than leaving them behind when they cannot be listed.

## The intro, for fun

Every screenshot now gets its own little envelope.

## The punchline, for fun

And throwing the folder away finally empties it too.

## The options, in plain words

A. As built: one address per screenshot under its question, and the page's delete removes the screenshots too.
B. One upload address per question that takes the screenshot's number in the body, the delete as built.
C. The addresses as built, and the page's delete leaves the screenshots as it did before.

## What I had to decide

The upload route: POST /api/ask/rounds/:id/attachments/:name (one screenshot per request, its body the file, its type the content-type, at most 4 MB, 413 {error: "too-large"}, 409 when the file is already there, 403 when the bucket's rules refuse) and DELETE on the same path. The page's delete now calls DELETE /api/ask/sessions/:id (src/ask/api.ts deleteSession), which removes the session's screenshots before its rows; before s3 the page deleted the rows only.

## What I did meanwhile

src/ask/ask.client.ts's bucket() serves src/ask/page/attachments.ts's uploads unchanged: same numbering, same retry, same clean-up when the round was taken.

## What it costs to change later

Moving the route is a rename of one route folder and one client path; the delete change is api.ts's existing behaviour, with no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says one screenshot per POST through the controller, not its address, and does not mention the page's delete.
