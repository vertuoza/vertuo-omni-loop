---
id: s5-04-terraform-never-runs-a-command-that-publishes
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The setup skill writes a command down only after running it successfully. What about commands that publish, deploy or change shared data, which must not be run just to check them?

## The decision, in plain words

It never runs them, so it never writes them down as checked; the page points at the file where they are defined, or asks a person.

## The options, in plain words

A. Never run a command that deploys, publishes, releases or changes shared data; point at where it is defined, or ask a person.
B. Write such commands down as the repository shows them, marked as not checked.
C. Run them in a rehearsal mode when the tool offers one, and write them down when that succeeds.

## What I had to decide

Decision 6 and step 4 of the spec say every command is run once, green, before it is written, and its slot carries `verified: <date>`. The releasing form's `how` and `rollback` slots, and some CI steps, name commands that deploy, publish or migrate: running them to verify them would publish. The spec does not say which commands terraform may run.

## What I did meanwhile

Step 3 of `kit/plugin/skills/terraform/SKILL.md` runs only commands that check or build (install, build, test, lint, typecheck, the preflight). A deploy, publish, release, shared-database migration or shared-environment write is never run and never written as verified: its section is a `See:` line to the file that defines it, or a `TODO(human)` question. A command that changes tracked files is undone with `git restore` before the next step.

## What it costs to change later

A constant: a few lines of skill prose, before or after merge. Forms written meanwhile hold pointers to where those commands live, which stay true under any later rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any repository's release or deploy command is safe to run from a checkout, which would let terraform verify it.
