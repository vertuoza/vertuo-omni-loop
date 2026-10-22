---
id: s2-01-which-issues-break-main
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Which new issues should count as a delivery having broken main?

## The decision, in plain words

An issue counts when a person opened it within the seven days and it names the delivery, or when it is marked as a regression and its triage names one of the delivery's pull requests. Issues opened by an app, and the retro's own issues, never count.

## The intro, for fun

The retro files issues about the delivery, and suddenly the delivery looks guilty of everything.

## The punchline, for fun

Only a person's report can break main; the robots are not allowed to tell on it.

## The options, in plain words

A. Count only issues a person opened, leaving out app-made and retro issues; read the triage only on issues marked as a regression (built).
B. Count every issue that names the delivery, the retro's own included.
C. Read the triage of every new issue, marked or not, at one more request per issue each day.

## What I had to decide

Whether the main watch counts an issue opened within the seven days only when a person opened it (not an app) and it does not carry `labels.retro`, and reads the `/omni:bug-fix` triage comment only on issues labelled `labels.regression`. Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built as option A in `apps/omni-app/src/main-watch/signals.ts` (`isReport`, `tracer`): an issue naming `#<n>` (in a target repository, only `<plan>#<n>`) counts; a `labels.regression` issue counts when its body or its triage's Regression line names one of the lane's pull requests.

## What it costs to change later

A rule in one file: widening or narrowing it changes which future breaks are recorded, never a stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says an issue naming the PRD counts, but the retro opens issues naming the PRD at every merge, so counting them would mark almost every PRD broke
- (author) a triage whose regression label could not be added is not read, since only labelled issues have their comments read
