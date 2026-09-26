---
id: s5-02-out-of-reach-is-not-outsider
prd: 100
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When the game's database cannot be reached, the arcade cannot tell whether a signed-in person belongs to a workspace. Should it treat them as a member or turn them away?

## The decision, in plain words

It treats them as a member: they see the message that the galaxy is out of reach, never the screen that says their account is the wrong one.

## The intro, for fun

The guest list is locked in a room nobody can open right now. Who gets in?

## The punchline, for fun

Everyone gets to the lobby, and a sign there says the party is delayed.

## The options, in plain words

A. Treat them as a member, and show the out-of-reach message. This is what was built.
B. Treat them as an outsider, and show the wrong-cartridge screen until the database answers again.
C. Fall back to the email address while the database is out of reach, as before workspaces.

## What I had to decide

What `Session.crew` is when the page cannot read the person's memberships. The spec says a signed-in person with no workspace gets the outsider screen, and its Risks say an arcade deployed a few minutes before the migration shows "THE GALAXY IS OUT OF REACH" for those minutes; it does not say what "crew" is while membership cannot be read. Today's error path took crew from the email, so a Vertuoza account went on to the gate.

## What I did meanwhile

`arcadeFor()` in `apps/galaxy/src/data/arcade.ts`: when any read fails (the memberships, `join_by_domain()` or a loader), the page renders the attract mode with the built-in fleets, `problem` set to the out-of-reach message, and `crew: true`, keeping the workspace's brand when it was read before the failure. START then leads to the gate, and every galaxy screen answers with the out-of-reach toast, as before. `arcade.test.ts` pins it. Nothing becomes readable: row-level security still refuses a non-member.

## What it costs to change later

One boolean in `arcadeFor()`'s error path, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person outside every workspace should rather see the wrong-cartridge screen during an outage, at the price of a Vertuoza member seeing it too (author)
