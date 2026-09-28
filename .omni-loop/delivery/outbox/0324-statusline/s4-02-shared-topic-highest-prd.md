---
id: s4-02-shared-topic-highest-prd
prd: 324
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The status line finds the PRD from the short name in the session's branch. If two PRDs ever carry the same short name, which one should the line show?

## The decision, in plain words

The one with the highest number, the newest of the two, wherever its folder was found.

## The intro, for fun

Two PRDs walked in wearing the same name tag.

## The punchline, for fun

The line greets the younger one, and the older one does not seem to mind.

## The options, in plain words

A. Show the PRD with the highest number: the option built.
B. Show a PRD still in the inbox over a shipped one, then the highest number.
C. Show no PRD at all when two share the name, so the line never names the wrong one.

## What I had to decide

Which PRD folder a branch's topic names when more than one folder `<nnnn>-<topic>` carries it, across the inbox and shipped folders of the checkout and of the base. The spec says "the topic names the PRD whose folder is `<nnnn>-<topic>`", as if there were only one.

## What I did meanwhile

`folderOfTopic` in `kit/lib/statusline/which-prd.mjs` takes the folder with the highest PRD number among every folder carrying the topic, wherever it was found; `kit/lib/statusline/which-prd.test.mjs` pins it (`0003-alpha`, `0007-alpha` and `0012-alpha` read PRD 12).

## What it costs to change later

One comparison in `kit/lib/statusline/which-prd.mjs` and one case in its test. No stored data, and no other slice depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a topic is unique across the delivery folders, nor which PRD a branch names when two folders carry its topic.
