---
id: s9-02-default-branch-conflict-to-a-person
prd: 7
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

When the finished work clashes with changes made meanwhile on the main line, should the robot sort out the clash itself or hand it to a person?

## The decision, in plain words

It sorts out clashes it is confident about, and hands any other to a person, leaving the work as a draft marked stuck.

## The options, in plain words

A. Resolve when confident, otherwise abort and hand to a person (built).
B. Always abort on any conflict and hand to a person.
C. Always resolve, as upstream did, and only go stuck when the preflight stays red.

## What I had to decide

Upstream yolo always merged the default branch into the feature branch at the finish and resolved any conflict inline. The pr skill resolves a conflicting PR itself, but leaves a merely behind PR into the default branch to a person. The dispatch for this slice said conflicts go to a person.

## What I did meanwhile

The finish step merges the default branch only when the feature branch is behind; a conflict it cannot resolve with confidence is aborted and the feature PR takes the pr skill's Stuck path naming the conflicting files.

## What it costs to change later

Low: one step of prose; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Confident is a judgement call; there is no kit rule for it. (author)
