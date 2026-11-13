# Product knowledge principles

## P-PRODUCTKNOWLEDGE-3

The knowledge history records every real change to product knowledge, and only real changes.

Why: A history padded with saves that changed nothing hides the edits people actually need to trace.
Source: .omni-loop/delivery/shipped/2779-open-personas/outbox/settled.md, entry s1-02-unchanged-edit-not-recorded, PRD #2779
Merged: @pierrederval, 2026-11-13, PR #2781
Proposed: harvest 2026-11-13

## P-PRODUCTKNOWLEDGE-4

An edit made by naming a piece of product knowledge never lands on an entry it was not meant for; when the name is not certain, nothing is changed.

Why: Names are not unique, so a loose match could silently change the wrong persona and mislead every agent that reads it.
Source: .omni-loop/delivery/shipped/2779-open-personas/outbox/settled.md, entry s1-03-find-by-exact-name, PRD #2779
Merged: @pierrederval, 2026-11-13, PR #2781
Proposed: harvest 2026-11-13

## P-PRODUCTKNOWLEDGE-5

A knowledge entry's last-changed date means a person changed it; a change the system makes is still written in the knowledge history, attributed to no person.

Why: Readers trust the changed date to show human edits, while the history must still account for every change.
Source: .omni-loop/delivery/shipped/2779-open-personas/outbox/settled.md, entry s1-04-rename-keeps-changed-date, PRD #2779
Merged: @pierrederval, 2026-11-13, PR #2781
Proposed: harvest 2026-11-13
