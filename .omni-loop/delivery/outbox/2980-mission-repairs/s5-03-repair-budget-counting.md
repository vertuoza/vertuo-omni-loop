---
id: s5-03-repair-budget-counting
prd: 2980
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

Three counting questions the spec left open: when does a new round of repairs start, how is a repair whose report cannot be read counted, and what happens to a repair of a cause that already used its three?

## The decision, in plain words

A new round starts each time a person resumes a mission that had stopped, and a repair that left no readable report counts against the PRD it repaired, so three of those stop it. A cause that already used its three is found out only once its retro runs, so that retro still runs and nothing it proposes is applied.

## The intro, for fun

Counting to three sounds easy until someone asks which three.

## The punchline, for fun

The abacus now has a rule for every bead.

## The options, in plain words

A. A round per Resume of a stopped mission, unreadable repairs counted per PRD, and a 4th retro that runs and applies nothing.
B. The repair skill is told which causes are spent and stops after its retro, so no fix pull request is opened for them.
C. Every Resume opens a round, a paused mission's included.

## What I had to decide

Three choices in apps/omni-app/src/missions/repair.ts and repair-run.ts. The round is roundOf(events): 1, and one more for each resumed event that follows the mission's own stopped event, since the database takes the round from the supervisor. A record line that cannot be read, a repair job that failed, or a record naming another mission or PRD is kept under one fingerprint per PRD (unreadableFingerprint), ends not fixed and spends one of the mission's 9; three such in a round stop that PRD. The supervisor cannot know a failure's fingerprint before its retro, so a 4th failure of a spent cause still sends a repair: its retro runs, the database refuses its row, and the PRD stops with the cause, what was tried, the proposed fix and how to resume; a fix pull request that repair opened is never landed.

## What I did meanwhile

Built as decided: the caps hold in the supervisor and in the database alike, and every count is tested on the fake fleet (repair.test.ts).

## What it costs to change later

Each is a constant or one function: the round rule, the fingerprint an unreadable record is kept under, or passing the spent fingerprints to the repair skill so it stops after its retro.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a 4th failure of a repaired cause sends no repair, but the cause is known only from the retro the repair writes, so the retro runs once more.
- (author) The spec does not say whether a Resume after a pause opens a round.
