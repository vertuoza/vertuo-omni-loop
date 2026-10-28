---
id: s8-03-instance-skills-folder
prd: 2537
slice: s8
rank: medium
bears-on: none
raised: 2026-10-28
wave: 4
---

## The question, in plain words

Before a Codex or OpenCode account works on a job, the runner puts the kit's skills in that account's own folder. Which folder is it, and what happens when the skills cannot be put there?

## The decision, in plain words

The runner uses the folder the account's settings in T3 name, else the agent's usual folder in the home. When the skills cannot be written, that account is passed over and the next one takes the job, as if it were busy.

## The intro, for fun

Every new player needs the rulebook before joining the game.

## The punchline, for fun

No rulebook, no seat: the next player sits down instead.

## The options, in plain words

A. Use the home folder T3's settings name for the instance, else the agent's default folder, and pass an account without skills over, the option built.
B. Fail the job at once when its first account cannot have the skills, naming why.
C. Read the folder from the accounts file instead, a field of the account, and refuse a Codex or OpenCode account without it.

## What I had to decide

Where a T3 Codex or OpenCode instance's skills go (its config.homePath in T3's settings.json, else ~/.codex or ~/.config/opencode), and whether an instance that cannot have them hands the job to the next account or fails it.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

turnoverOf in kit/lib/runner/turnover.ts reads providerInstances.<id>.config.homePath from ~/.t3/userdata/settings.json and calls prepareInstanceSkills (plugin.ts, s5) before every part on a non-Claude instance; job.ts passes over an account it answers unusable for, at the start (no part, no account change counted) and at a turnover, and fails the job only when no account is left.

## What it costs to change later

The folder rule is one function; failing instead of passing over is one branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the T3 0.1.3 recordings show config.homePath only on a Claude instance: whether T3 names a Codex instance's CODEX_HOME the same way is not recorded
- an account found without skills is not marked unusable in the runner's account states, so the health report does not read no skills for it yet (s6's ground)
