---
id: s1-02-what-a-level-answers
prd: 2416
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

When a repository leaves a rule unwritten, which of the higher levels' rules count as an answer, and how is a rule the repository marked as an open question shown?

## The decision, in plain words

Only written text from a higher level counts: an empty rule, an open question or a link to another file there is skipped, and the next level is read. When the repository itself left an open question, the higher level's text shows in place of the generic default and the question stays listed under it.

## The intro, for fun

Asking the grown-ups only helps when they actually answer.

## The punchline, for fun

A shrug from upstairs gets passed further up.

## The options, in plain words

A. Only a higher level's written text answers; a rule the repository left as an open question shows that text, tagged with its level, and keeps the question: the option built.
B. A rule the repository left as an open question keeps the generic default, and the higher levels answer only a rule the repository left empty.
C. A higher level's link to another file answers too, shown as the link it is and tagged with its level, even when the file cannot be read here.

## What I had to decide

What counts as a level's answer for a playbook section, and how a repository hole reads. Built (`kit/lib/playbook/resolve.ts`): a level's section answers only when it holds text; an empty one, a `TODO(human)`-only one (the plan's rule), a `See:` line, or a whole pointer form at that level falls through, because its path names the other repository's file, not this disk's. A repository section holding only `TODO(human)` lines keeps its questions and shows the nearest level's text in place of the kit default, labelled `[hole · plan repo]` or `[hole · omni settings]`; with no level answering it is `[hole]` as today. A level's text is never filled from the config. In `kb show --json`, a section answered by a level carries `source: plan-repo` or `omni-settings` and its tag in `label`; no new field is added, so a repository with no copy prints its JSON as before.

## What I did meanwhile

Every rule is a branch of one resolver function, proven by `kit/lib/playbook/resolve.test.ts`; nothing is stored.

## What it costs to change later

A change of mind is a few lines in the resolver and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a level's `See:` line should instead show the pointer text, or read the file from the copy when the copy holds it (author)
