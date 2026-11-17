---
id: s2-02-repair-round-given-by-the-supervisor
prd: 2980
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

Each cause may be repaired three times per round, and a person's Resume opens a new round. Who says which round a repair belongs to?

## The decision, in plain words

The mission's supervisor names the round on each repair it records. The database counts three per cause inside whatever round it is given, and nine for the whole mission across every round, so even a wrong round never lets a mission run more than nine repairs.

## The intro, for fun

Three tries per round sounds fair, until someone gets to decide when a round starts.

## The punchline, for fun

So the referee may call a new round, but the clock on the wall still stops at nine.

## The options, in plain words

A. A. The supervisor names the round, and the database caps three per cause within it and nine in all: the option built.
B. B. The mission keeps its own round counter, which Resume moves, and the database fills the round itself.
C. C. No rounds in the database: it caps nine per mission only, and the three per cause is the supervisor's alone.

## What I had to decide

Whether the round stays a number the supervisor gives, or becomes the mission's own counter that the database moves on each Resume.

## What I did meanwhile

mission_repairs.round is an integer, 1 by default, given on insert. The database refuses a 4th repair of one fingerprint in the same mission and round, and a 10th repair of the mission in all rounds, a lost repair apart. Nothing in the database opens a round: the Resume of a stopped PRD (s5, s6) passes the next round.

## What it costs to change later

A small migration: a repair_round column on missions, moved by Resume, and the budget trigger reading it instead of the caller's number. The rows already written keep their round.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says a Resume opens a new round but not whether it is the mission's Resume or a stopped PRD's
- (author) today a mission's Resume moves a paused mission only, so the round cannot hang on it yet
