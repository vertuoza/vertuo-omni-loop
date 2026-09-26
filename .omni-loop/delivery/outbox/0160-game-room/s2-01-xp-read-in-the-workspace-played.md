---
id: s2-01-xp-read-in-the-workspace-played
prd: 160
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The design says the arcade reads a player's XP along with the galaxy, but it was written before a person could belong to several company spaces. Whose XP should a person in two spaces see, and should a failed XP read hide the galaxy too?

## The decision, in plain words

I show the XP earned in the space the arcade already plays for that person, the one they joined first. I read it on its own, so when it fails the galaxy still shows and the game room says the XP is out of reach.

## The intro, for fun

The recipe said to fetch the XP with the groceries, then the town opened a second market.

## The punchline, for fun

So we shop at the market we always go to, and a missing loaf no longer cancels dinner.

## The options, in plain words

A. Show the XP of the space the arcade plays, the one joined first, read on its own so a failure never hides the galaxy.
B. Read the XP together with the galaxy, so any failed read shows the whole galaxy as out of reach.
C. Add up a person's XP across every space they belong to.

## What I had to decide

The spec (The arcade, Reading) says the page reads the player's `player_xp` row by lower-cased login "along with the galaxy, as the signed-in member". PRD 100 landed `arcadeFor()` in `apps/galaxy/src/data/arcade.ts`: it plays the workspace the member joined first (`memberWorkspace()` in `apps/galaxy/src/data/workspace.ts`) and loads the galaxy, the fleets, the player and the crew in one `Promise.all`, so one failed read makes the whole page out of reach. The spec names neither which workspace's XP a member of several sees, nor whether a failed XP read takes the galaxy with it; it only says an unreadable XP shows no level. A drift between the spec and the code #100 landed.

## What I did meanwhile

`apps/galaxy/src/data/xp.ts` (`loadXp`, `readXp`) reads `player_xp` with `workspace_id` set to the workspace `arcadeFor()` plays and `github_login` set to the player row's login (or the session's linked one), lower-cased, after the other reads. A failed read is logged and becomes `'unreadable'`: the menu and the room say XP out of reach and show no level, and the galaxy, the fleets and the crew stay as read. `apps/galaxy/src/data/arcade.test.ts` pins both: a member of Acme and Vertuoza reads Acme's row only, and XP out of reach keeps the galaxy.

## What it costs to change later

Low. Reading XP inside the galaxy's `Promise.all` is a two-line change in `arcadeFor()`; reading another workspace's row is one filter, once switching workspaces exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a member of two workspaces should see each workspace's XP on its own, as `player_xp` stores it, or one total across them, which would need a new read.
