---
id: s2-02-mine-means-fixes-you-pushed
prd: 627
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On the Visual Updates and Bug Fixes lists, which fixes count as Mine?

## The decision, in plain words

Mine is the fixes you sent to the page yourself, as it is for PRDs. A fix the page read from a repository on its own shows only under All.

## The intro, for fun

Everyone asks whose fix it is; the list answers: whoever pressed send.

## The punchline, for fun

Finders keepers, pushers listers.

## The options, in plain words

A. A. Mine is the fixes you sent to the page (built).
B. B. Mine is the fixes whose issue you opened, once a later slice reads who asked.
C. C. Mine is every fix you sent, asked for or reviewed.

## What I had to decide

Whether Mine should mean the fixes you sent, the fixes you asked for, or the fixes you reviewed.

## What I did meanwhile

Mine keeps the fixes whose page was opened by the viewer's push, exactly as the PRD list does; All shows every fix of the workspace.

## What it costs to change later

A constant in the list's filter; who asked for a fix is read from GitHub by a later slice, and Mine could switch to it then.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists Mine and All among the filters without saying whose fixes Mine holds; who asked is only read from GitHub in a later slice.
