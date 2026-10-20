---
id: s2-02-runner-help-entry-left-out
prd: 2255
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The built-in help for the runner command does not yet mention the two new verbs, because that help text lies outside this piece of work. Should it be extended here?

## The decision, in plain words

The help text was left as it is. The two new verbs still print a usage line when they are mistyped, and the skills name them in full.

## The intro, for fun

A verb with no line in the manual is a rumour.

## The punchline, for fun

For now, only its usage line vouches for it.

## The options, in plain words

A. Leave the help as it is, and let the skills and the usage lines document the two verbs.
B. Add the two verbs to the help text in a follow-up slice that owns that file.
C. Widen this slice's territory to the help file and add them now.

## What I had to decide

`kit/lib/help/entries.ts` documents `omni runner`; it is outside s2's territory (`kit/bin/commands/runner`, `kit/lib/runner/`, the two bug-fix skills, `kit/test/need-human`), so `omni help runner` does not list `ask` and `answers`.

## What I did meanwhile

Wrote the usage lines into `kit/bin/commands/runner.ts` (`omni runner ask --file <file> --issue <n> --lead <file>`, `omni runner answers <job>`), and the command's header comment documents both verbs.

## What it costs to change later

One entry in `kit/lib/help/entries.ts` and its snapshot, in a slice whose territory names that file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a help entry for a verb run inside a job's session is wanted at all, since only skills call it
