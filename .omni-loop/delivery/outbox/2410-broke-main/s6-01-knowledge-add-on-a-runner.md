---
id: s6-01-knowledge-add-on-a-runner
prd: 2410
slice: s6
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

A runner may now run knowledge-add, as the plan asks, but that skill refuses to write anything when nobody is at the terminal, and it only knows constituents, Legal entries and glossary terms. Should a runner job of it stay a no-op for now?

## The decision, in plain words

I listed knowledge-add among the skills a runner may run, as planned, and left the skill itself unchanged. A runner job of it ends at once and says it wrote nothing, until the skill learns to propose a playbook or register rule on its own.

## The intro, for fun

A helper was hired for the night shift, but its contract still says to wait for a yes.

## The punchline, for fun

So it clocks in, finds nobody to ask, and politely goes home.

## The options, in plain words

A. A. List knowledge-add as runnable now, as built: the job ends writing nothing until the skill learns to run unattended
B. B. Take knowledge-add off the runner lists until the skill can run unattended
C. C. Teach knowledge-add an unattended path that proposes a playbook or register rule, never writes it directly, in s7 or a follow-up PRD

## What I had to decide

Pick A to keep it as built, B to take knowledge-add off the runner lists, or C to give it a way to propose a playbook or register rule with nobody at the terminal (s7 or a follow-up PRD).

## What I did meanwhile

The runner lists name knowledge-add; the skill writes nothing under OMNI_UNATTENDED, so an approved playbook or register finding queues a job that ends at once, writing nothing.

## What it costs to change later

Taking it off is one word in each runner list and the guide; teaching it to run unattended is a change to its skill, which lies outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The line check refuses quotes, so the line s7 queues cannot read /omni:knowledge-add '<the finding>' as the spec writes it; s7 must send the finding another way. (author)
- Whether an unattended knowledge-add should propose (wait for the section's owner) or apply was not asked. (author)
