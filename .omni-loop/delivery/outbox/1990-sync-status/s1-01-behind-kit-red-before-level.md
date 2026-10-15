---
id: s1-01-behind-kit-red-before-level
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When this computer's Omni or its plugins are behind the latest release, should that count as red before the team's setting caps it, so a lead who asks for red gets red?

## The decision, in plain words

Being behind counts as red, and the default setting caps it to orange, so nothing changes for anyone who keeps the defaults; a lead who sets the kit check to red makes the whole team see red until they update.

## The intro, for fun

The spec said orange, and the lead's story said red.

## The punchline, for fun

So the colour now listens to the lead.

## The options, in plain words

A. Behind kit and plugins count red, capped to orange by default: the lead's red setting works.
B. Keep them orange as section 5 reads: levels.kit: red then shows orange, and the user story is dropped.
C. Also count a target repository's older kit red before the level.

## What I had to decide

Spec section 5 says a repository kit or a plugin older than the latest release is an orange finding, and section 6 says a level only ever lowers a colour. Read together, setting sync.levels.kit to red could never show red, which breaks the user story where a lead sets sync.levels.kit: red and the team sees red until they update. I made those two findings (repo kit and plugin versions) red before the level; with the default level, orange, they show orange exactly as section 5 and the acceptance criteria say. A target repository's older kit, a missing kit and a missing plugin stay orange.

## What I did meanwhile

kit/lib/sync/status.ts raises repoKitFindings and pluginFindings as red; status.test.ts proves orange under the defaults and red under levels.kit: red.

## What it costs to change later

A constant per finding: flipping them back to orange is a two-line change and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a target repository's older kit should also turn red under levels.kit: red was not asked (author).
