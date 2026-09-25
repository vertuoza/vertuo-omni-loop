---
id: s4-03-outbox-check-red-is-the-gate
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the only red check on a pull request is the outbox check, should the agent try to fix it like any failing check?

## The decision, in plain words

No, the agent asks the kit for the outbox status and stops when only questions for a person remain, since that red check is the gate working. It never counts that as a failed attempt and never adds the override label.

## The options, in plain words

A. Stop and report when only person-answered items remain, the option built.
B. Treat it as any red check, counting attempts and ending in the needs-fix label.

## What I had to decide

How `/omni:pr` treats a red `ci.outboxContext`, which upstream folded into its single aggregate check.

## What I did meanwhile

A lifecycle row: only `ci.outboxContext` red → run `omni status <prd>`; red only for items a person must answer means say so in the status comment and stop; anything else is fixed through the outbox, never by `labels.outboxGo`. This matches spec §2 (`/omni:yolo` ends with the gate red when items are open).

## What it costs to change later

One table row of `kit/plugin/skills/pr/SKILL.md`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a stopped PR in this state should keep the in-progress label or drop it.
