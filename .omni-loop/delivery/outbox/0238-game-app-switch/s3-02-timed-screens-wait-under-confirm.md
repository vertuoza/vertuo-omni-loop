---
id: s3-02-timed-screens-wait-under-confirm
prd: 238
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Some screens of the arcade move on by themselves after a few seconds, such as the start-up screen and the welcome back. If the question about leaving for the app is up over one of them, should they still move on underneath it?

## The decision, in plain words

No: they wait while the question is up, so saying no shows the same screen, which then starts its few seconds again.

## The intro, for fun

The start-up screen had three seconds to live, and then someone asked it a question.

## The punchline, for fun

It held its breath until the answer, then counted to three again.

## The options, in plain words

A. They wait, and start their few seconds again after a no, the option built.
B. They wait, and pick up where they stopped after a no.
C. They keep running, and a no shows whichever screen came next.

## What I had to decide

Whether the arcade's timed hand-overs (the boot to the title, the intro to the fleet select, the welcome to the menu, the fleet lock-in to the next step) keep running while OPEN THE APP? is open over their scene.

## What I did meanwhile

In src/arcade/ArcadeApp.tsx the timed hand-overs wait while the confirm is open, and each starts again in full once B closes it (the fleet lock-in still counts from when it began). Only the menu opens the confirm today; the Game Boy's switch will open it on every scene.

## What it costs to change later

One condition in ArcadeApp.tsx's timed hand-overs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says B leaves the scene exactly as it was, and that the switch works from the boot on; it does not say whether a screen that moves on by itself should move on under the question.
