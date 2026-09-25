---
id: s6-01-rework-close-searches-every-prd
prd: 7
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

How does the close command find which PRD's own record to amend, since the drifted item's own id never names a PRD by itself.

## The decision, in plain words

It looks through every PRD's own record for a matching id and acts on the first one it finds, rather than asking the person to name the PRD.

## The options, in plain words

A. Search every PRD's own record for a matching id, and act on the first match found.
B. Require the person to name the PRD directly, alongside the id, before making any change.

## What I had to decide

Whether the close command should require the person to name the PRD directly, or should find it on its own by searching every PRD's own record for the id.

## What I did meanwhile

It searches every PRD's own record for a settled entry with that id, and acts on the first match it finds.

## What it costs to change later

Adding a required PRD flag later is a small, backward-compatible change with no data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- What happens when two different PRDs happen to raise the same slice id — the first match found wins silently, with no warning that another PRD also holds one.
