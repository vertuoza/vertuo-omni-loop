---
id: s8-01-door-inside-release-step
prd: 251
slice: s8
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where in the build's closing steps should the offer to answer the questions in the terminal sit, now that the last step is the hand-off another skill points to by number?

## The decision, in plain words

The offer sits at the end of the release step, so every step keeps its number and the fix-up skill's pointer to the hand-off stays right.

## The intro, for fun

Every step wanted to keep its house number, so the new guest moved into the back room.

## The punchline, for fun

Nobody had to reprint the street map.

## The options, in plain words

A. The door is the last part of step 6; every step keeps its number.
B. The door becomes step 7 and the hand-off step 8, with the yolo-fix skill's pointer and the tests renumbered in a follow-up.

## What I had to decide

The first build made the terminal door its own step 7 and pushed the report to step 8. Today the yolo's step 7 is a long hand-off that the yolo-fix skill names as `/omni:yolo` §7, and plugin tests pin it as step 7. Renumbering would need an edit to the yolo-fix skill, outside this slice's ground.

## What I did meanwhile

The door is a `### Answer here, when the gate ends red` part at the end of step 6 (Release), after the final status comment; the hand-off stays step 7, and the test pins the part inside step 6 and before step 7.

## What it costs to change later

A constant: moving the part to a step of its own is a heading change in the yolo skill, one line in the yolo-fix skill's pointer, and the test's heading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person prefers the door as its own numbered step for readability (author).
