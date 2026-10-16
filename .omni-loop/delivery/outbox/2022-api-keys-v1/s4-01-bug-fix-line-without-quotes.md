---
id: s4-01-bug-fix-line-without-quotes
prd: 2022
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 4
---

## The question, in plain words

The spec says the bug fix line reads with the description in single quotes, but the runners' own line check refuses a quote mark. How should the line be written?

## The decision, in plain words

The line is written without quotes, so the description follows the skill name directly and the runners accept it.

## The intro, for fun

A line wanted quotes, but the bouncer at the door turns quotes away.

## The punchline, for fun

So the description walks in bare, and the bouncer waves it through.

## The options, in plain words

A. A. Build the line without quotes and keep the runners' check as it is (built).
B. B. Widen the runners' line check to accept quoted arguments, in a follow-up PRD, then quote the description.

## What I had to decide

The spec asks for `/omni:bug-fix '<description>'` and that it pass `checkLine`. `checkLine` allows only letters, digits, spaces and . _ / : # - in the arguments, so every quoted line is refused. The route builds `/omni:bug-fix <description>` and the runners' check stays untouched. Reversible by changing one constant in public-api.service.ts together with the runners' check.

## What I did meanwhile

Descriptions can hold letters, digits, spaces and . _ / : # - only; any other character answers 422 with the runners' reason.

## What it costs to change later

A description cannot carry punctuation such as commas or apostrophes until the runners' line rule widens.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the runners' line rule should accept quotes is not settled by the spec (author).
