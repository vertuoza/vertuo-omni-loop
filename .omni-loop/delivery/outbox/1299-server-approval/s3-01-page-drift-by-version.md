---
id: s3-01-page-drift-by-version
prd: 1299
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The PRD page says an approved PRD has drifted when a newer version of one of the approved files was pushed. Should a file that was not part of the approval, pushed later, also count as drift?

## The decision, in plain words

Only the files the approval covered count. A newer version of any of them shows drifted and brings the Approve button back; a file pushed for the first time after the approval leaves the page saying approved.

## The intro, for fun

An approval is a photo of the files on the day it was taken.

## The punchline, for fun

Someone walking into the frame afterwards does not spoil the photo.

## The options, in plain words

A. Only the approved files count toward drift (built).
B. Any file of a kind the approval would pin today, pushed after the approval, also shows drifted.

## What I had to decide

Whether a file first pushed after the approval should also make the page say drifted.

## What I did meanwhile

The page compares each approved file with the newest version of the same kind and ignores kinds the approval did not cover.

## What it costs to change later

Changing it is one condition in the page's approval view and one test; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether drift covers a kind the approval did not pin, such as a voice file pushed for the first time after it (author).
