---
id: s5-01-room-says-waits-from-existing-reads
prd: 2949
slice: s5
rank: medium
bears-on: none
raised: 2026-11-16
wave: 3
---

## The question, in plain words

Where does the room get the wait it says, since the screen reads no runner state of its own?

## The decision, in plain words

The room and the Missions tab read the mission's queued jobs, the job a resume follows (its limit time and account) and the supervisor's own words about what the mission waits on. A limit is read from the jobs; "all runners are busy" is read from the supervisor's words, because the room has no runner state to judge it from.

## The intro, for fun

The room learned to say why nobody is moving.

## The punchline, for fun

It asks the supervisor and does not guess.

## The options, in plain words

A. Read the supervisor's words for the room wait (done)
B. Have the room read the runners and their slots and judge room itself
C. Have the supervisor store the wait as its own field the room reads

## What I had to decide

How the room learns that a PRD waits for room, and which job it links. The line links the job that ran out for a limit, and the queued job for room.

## What I did meanwhile

Built A. The words are cut at 300 characters by the supervisor, so a very long list of waiting PRDs could drop a room wait from the line; the supervisor's own words still say it.

## What it costs to change later

Low: C replaces one parsing function (`waitsOf` in `limit-wait.ts`) and the read.

## What I could not know

(author) Whether a stored wait field is wanted to avoid reading the words.

The `fleet-room` screen's two waiting states match what is built. The screen is a draft and its mockup was not redrawn.
