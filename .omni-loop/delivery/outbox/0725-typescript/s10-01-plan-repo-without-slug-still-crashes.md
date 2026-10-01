---
id: s10-01-plan-repo-without-slug-still-crashes
prd: 725
slice: s10
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

Grading the plan of a planning repository that never wrote down its own name stops with a crash instead of a clear message. Should this slice fix that?

## The decision, in plain words

Left as it is: this slice only adds types and must not change what the tool does. The crash is kept, marked, and left for its own fix later.

## The intro, for fun

A planning repository forgot to write its own name on the door.

## The punchline, for fun

The grader still faints at the door, but now there is a note pinned to it.

## The options, in plain words

A. Keep the crash for now, marked, and fix it in its own pull request
B. Have the plan grader report a missing repository name as a plain violation
C. Have the settings reader refuse a planning repository that does not name itself

## What I had to decide

kit/lib/inbox/plan-grade.ts passes config.repo.slug to the plan-repository checks, which read it as text. The config allows repo.slug to be null, and a plan section with a null slug makes shortName(null) throw a TypeError. Typing it means either keeping that throw or changing the output.

## What I did meanwhile

Kept the throw: the line reads config.repo.slug! with a ts-allow comment naming this item. No output changes.

## What it costs to change later

Small: one later pull request adds a violation such as 'repo.slug: a plan repository names its own slug' in gradePlan, or a config refinement requiring repo.slug when plan is set, plus a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the config should refuse a plan section without repo.slug, or the grader should report it as a violation (author)
