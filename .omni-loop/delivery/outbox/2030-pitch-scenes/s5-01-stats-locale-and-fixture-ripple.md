---
id: s5-01-stats-locale-and-fixture-ripple
prd: 2030
slice: s5
rank: medium
bears-on: none
raised: 2026-10-21
wave: 4
---

## The question, in plain words

The figures must follow the language the video is written for, but the scene that draws them could not see that setting, and the new scene in the sample video moved timings other tests pin. May this piece change a few files outside its planned ground to fix both?

## The decision, in plain words

We let the video's timing carry the chosen language to every scene, and we updated the other tests that count the sample video's scenes and length, changing no behaviour they check.

## The intro, for fun

The figures wanted to speak French, but nobody had told the stage which language the show was in.

## The punchline, for fun

So we slipped the language into the running order, and the rest of the crew recounted the scenes.

## The options, in plain words

A. A. The video's timing carries the language, and the five tests outside the ground are updated for the seventh sample scene.
B. B. The engine's settings carry the language beside the colours and fonts, set where the engine is built; the same test updates stay.
C. C. Keep the sample video at six scenes and test the stats scene from a second sample, leaving the other tests untouched.

## What I had to decide

Whether the language setting should travel with the video's timing, as built, or with the engine's other settings (colours, fonts, credits), and whether the out-of-ground test updates may stay.

## What I did meanwhile

The timing carries the language; the five tests outside the ground count seven scenes and the longer sample video.

## What it costs to change later

Moving the language to the engine's settings is a few lines in two engine files and the test helpers that build an engine by hand; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan foresaw only the browser render test moving with the new sample scene; it did not list the timeline, load, input, scenes and pitch command tests that pin the sample video's scene count and length.
