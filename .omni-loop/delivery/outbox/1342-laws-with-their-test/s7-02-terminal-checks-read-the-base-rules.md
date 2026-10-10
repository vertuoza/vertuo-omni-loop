---
id: s7-02-terminal-checks-read-the-base-rules
prd: 1342
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The terminal checks for a bug fix, a visual fix and a feature's risky changes needed small edits in shared files outside this slice's ground to see a rule losing its test. Should this slice make them?

## The decision, in plain words

Yes: the edits are small and only hand the checks the rules as the main branch holds them, so the server and the terminal now judge the same way.

## The intro, for fun

Three checks were each given the old rulebook to compare with.

## The punchline, for fun

None of them had to learn a new trick, only where the shelf is.

## The options, in plain words

A. A. Wire all four terminal checks in this slice (built).
B. B. Wire only omni bug and omni visual, which the plan asks for, and leave coverage and status to a follow-up.
C. C. Revert the terminal wiring and open a follow-up slice for it.

## What I had to decide

Whether s7 wires the base knowledge folder into omni bug, omni visual, omni check coverage and the omni status gate, editing files no slice of this PRD owns (settled item s2-01 left the terminal commands to a follow-up).

## What I did meanwhile

Edited outside the territory: kit/lib/git.ts (baseKnowledge, and knowledgeAt moved there from kit/lib/status/facts.ts, which now imports it), kit/bin/branch-range.ts (fixLaws, and grade gets base and exec), kit/bin/commands/bug.ts, kit/bin/commands/visual.ts, kit/bin/commands/check.ts, kit/bin/commands/status.ts, kit/lib/outbox/account.ts (LAW_RULES exported) and a new test file, kit/bin/law-demoted.test.ts.

## What it costs to change later

A constant: each command drops its base argument and law-demoted goes back to firing only on the server.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's s7 territory names kit/lib/bug/ and kit/bin/bug.test.ts but not the command files that call them, so 'omni bug names the outbox' needed them.
- (author) The wave's territory check will flag these paths as outside s7.
