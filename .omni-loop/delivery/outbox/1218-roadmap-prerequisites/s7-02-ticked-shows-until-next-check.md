---
id: s7-02-ticked-shows-until-next-check
prd: 1218
slice: s7
rank: medium
bears-on: none
raised: 2026-10-08
wave: 6
---

## The question, in plain words

Right after a member marks a prerequisite as done, what should the tab show for it before the agent checks again?

## The decision, in plain words

The tab shows the row as ticked by you, with a note that the next check records it. Nothing extra is saved in the app: the tick lives as a comment on the roadmap's issue, and the next check picks it up and saves it for everyone.

## The intro, for fun

You ticked the box, and the box believes you.

## The punchline, for fun

The rest of the team hears about it at the next roll call.

## The options, in plain words

A. A. Show it ticked to the member on return, and let the next check record it for everyone (built).
B. B. Also save the tick on the prerequisite's row, so every viewer sees it at once.
C. C. Read the ticks from the roadmap's issue when the tab opens.

## What I had to decide

Whether the page should save the tick itself so every viewer sees it at once, or show it only to the member who ticked it until the next check records it.

## What I did meanwhile

The member who ticked sees the row ticked on return; another viewer, or the same member after reloading the plain page, sees its last checked state until the next check runs, which reads the comment.

## What it costs to change later

Option B needs a database change to store a tick on the prerequisite row and a write from the callback; the button and the comment stay as built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the tab shows the row ticked but not for whom or for how long; this slice's territory has no database migration, so storing it was not open here.
