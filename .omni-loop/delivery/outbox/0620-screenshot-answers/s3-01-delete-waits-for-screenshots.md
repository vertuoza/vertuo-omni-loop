---
id: s3-01-delete-waits-for-screenshots
prd: 620
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When someone deletes a session but its screenshots cannot be removed at that moment, should the session still be deleted?

## The decision, in plain words

The session is kept and the person sees an error asking them to try again, so no screenshot is ever left behind without its session.

## The intro, for fun

Taking out the rubbish is easy, unless the bin lid is stuck.

## The punchline, for fun

So the rubbish waits by the door until the lid opens.

## The options, in plain words

A. A. Keep the session and ask to try again when its screenshots cannot be removed (built).
B. B. Delete the session anyway and leave any screenshots that could not be removed in the store.
C. C. Delete the session anyway and retry the screenshot removal later in the background.

## What I had to decide

Whether a failed screenshot removal blocks deleting the session, or the session goes anyway.

## What I did meanwhile

Deleting a session refuses with a try-again error when the file store fails; the rows stay until a retry succeeds.

## What it costs to change later

Changing it later is one line in the delete handler: catch the removal failure and carry on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often the file store fails in production is unknown (author).
