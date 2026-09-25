---
id: s6-02-a-form-never-overrides-a-skill-rule
prd: 45
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When a repository's own page about how to work asks for something a delivery skill forbids, such as an agent merging its own pull request, which one does the agent follow?

## The decision, in plain words

The skill's rules win. A page adds steps and detail to what the agent does, but never loosens what the skill forbids.

## The options, in plain words

A. The skill's rules win; a repository's page only adds to them.
B. The repository's page wins wherever it speaks, since it knows the repository best.
C. Say nothing, and let the agent weigh the two case by case.

## What I had to decide

The spec wires each skill to read its forms through `omni kb show`, and decision 2 ranks the layers inside one form (pointer, then repository section, then kit default). It does not say how a form's text ranks against the skill that reads it: for example a filled `briefing` or `pull-requests` section saying to merge once green, while `/omni:pr` never merges a PR into `repo.defaultBranch`.

## What I did meanwhile

Step 0 of each of the seven skills, after printing the briefing, says: "A form adds to the steps below; it never overrides this skill's rules." The same paragraph says a `[hole]` is a question for a person, never a reason to stop (spec decision 7).

## What it costs to change later

Prose only, before or after merge: one sentence in the step 0 of seven `SKILL.md` files. No code and no stored data depend on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a repository should ever tighten or loosen a skill's rule through its playbook, for example its number of repair attempts: today that is what the config is for.
