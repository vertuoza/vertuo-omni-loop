---
id: s1-01-push-and-email-packages-wait-for-their-sender
prd: 1322
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The plan asked this first step to add the two libraries that send phone alerts and emails, but nothing in this step sends anything yet, and the repository refuses a library no code uses. Should they be added now or with the step that sends?

## The decision, in plain words

They are not added here: the step that sends the alerts and emails adds them, together with the code that uses them.

## The intro, for fun

Two libraries packed for a trip they cannot take yet.

## The punchline, for fun

They ride along with the sender instead.

## The options, in plain words

A. A. Add the libraries in the step that first sends an alert, with the code that uses them (built).
B. B. Add them here anyway and exempt them from the unused-dependency check until the sending step lands.

## What I had to decide

Whether the push and email libraries come in with this step or with the step that first sends an alert.

## What I did meanwhile

The settings for both channels are read and documented; the libraries arrive with the sending step, which also owns the package list and lock file changes it needs.

## What it costs to change later

Low: adding two dependencies later is a one-line change in the package list and a lock file refresh.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the package list and lock file only to this step; the sending step (s2) needs them added to its territory when it runs (author).
