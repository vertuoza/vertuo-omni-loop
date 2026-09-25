---
id: s6-02-long-errors-cover-the-picture
prd: 94
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When signing in or linking GitHub fails, the message comes from the sign-in service and can be of any length. On the small upright screen, where should a long one go?

## The decision, in plain words

The words keep their usual place when they fit. When a long message needs more room, the whole block of words moves up over the picture above it, so nothing runs off the bottom of the screen or under the button hints.

## The intro, for fun

Error messages never check the size of the screen before they start talking.

## The punchline, for fun

So the words politely climb up and stand on the picture instead.

## The options, in plain words

A. The block of words moves up over the picture when a long message needs the room. This is what was built.
B. The message is cut after two lines, ending with an ellipsis.
C. The block stays where it is, and a very long message runs past the bottom of the screen.

## What I had to decide

The coin's error line and the link's error line show a message the sign-in service or the auth callback hands back (a query parameter, or the error Supabase throws), so its length is not known. On the 320×288 grid the coin's words start at row 100 over a hint at the bottom, and the link panel starts at row 68 under the hero; a message longer than about two lines would run past the bottom edge or under the hint. The spec says a tall layout drops nothing, and does not say what gives way.

## What I did meanwhile

In `apps/galaxy/src/arcade/scenes/join.css`, on the tall grid the coin's and the link's roots are a grid whose first row (`minmax(0, 100px)` and `minmax(0, 68px)`) is the block's usual place and shrinks when the block needs the room: a short message leaves the layout as drawn, a long one lifts the block over the coin or the hero. Checked in the browser with a three-line message on each: the words stay inside the screen and clear of the hint. The wide grid keeps its fixed positions, as before.

## What it costs to change later

A constant: two rules in `join.css`. Going to option B means a line clamp on the error line in the same file; option C means removing the two grid rules.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long the messages the sign-in service really returns get: the longest seen in the code is 66 characters, and the service's own messages are not listed anywhere in the repository.
