---
id: s3-01-list-answer-checked-per-page
prd: 942
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

When GitHub answers a request for a list with something that is not a list, should the app say so plainly, or fail the way it did before?

## The decision, in plain words

The app now checks that each page is a list and, when it is not, fails with a message naming the request instead of a generic programming error. Lists GitHub answers normally read exactly as before.

## The intro, for fun

GitHub was asked for a list and, once in a blue moon, might hand back something else.

## The punchline, for fun

Now the app names the odd answer instead of tripping over it.

## The options, in plain words

A. A. Check each page is a list and fail naming the request (built).
B. B. Put the casts back with their reasons and keep the old generic error.

## What I had to decide

Whether a malformed list answer should fail with a message naming the request (built) or with the old generic error.

## What I did meanwhile

A list answer that is not a list fails with 'GitHub answered the open pull requests unexpectedly: (answer): …' in the knowledge harvest, and 'GET …/events answered an unexpected shape: …' in the retro's timeline, instead of a TypeError. Both still fail, and the timeline still treats only a 403 or 404 as unreadable.

## What it costs to change later

A constant: putting the old cast back in two places restores the old error.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test drives a non-list answer through the harvest or the timeline end to end; only ListSchema itself is tested with one (author).
