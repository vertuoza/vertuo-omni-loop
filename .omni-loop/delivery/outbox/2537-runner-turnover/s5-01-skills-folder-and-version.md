---
id: s5-01-skills-folder-and-version
prd: 2537
slice: s5
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

Where exactly does a Codex or OpenCode instance keep the skills it reads, and which version of the kit's skills does the runner write there, when the runner's own kit and the repository's pinned kit may differ?

## The decision, in plain words

The runner puts the skills in each agent's own skills folder, and writes the ones from its own kit only when that kit is as new as the repository's. An older runner kit makes the account read as having no skills rather than write old ones.

## The intro, for fun

A skill is only useful if the agent can find it, and only safe if it never lands in the pull request.

## The punchline, for fun

So the skills move into the agent's house, and the repository's door stays shut.

## The options, in plain words

A. The runner's kit writes its own skills when it is as new as the repository's pin, the option built.
B. The runner runs the repository's own kit to write the skills, so the version always matches the pin exactly.
C. The runner writes the skills of whichever kit is newest it can find, with no check.

## What I had to decide

How to honour "at the repository's pinned version" when the runner holds only its own kit's skills, and which folders the two agents read.

## What I did meanwhile

Built A, the way the Claude plugin is kept (a plugin as new or newer is accepted). The folders were taken from the spec, not from a real Codex or OpenCode install, so they are one function to correct.

## What it costs to change later

Option B is a different source of the skills text; the folder rules are one function, `instanceSkillsDir`, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no Codex or OpenCode install was available to confirm the folders they list skills from
- whether a newer runner kit's skills may differ from the repository's pin in a way that breaks a job
