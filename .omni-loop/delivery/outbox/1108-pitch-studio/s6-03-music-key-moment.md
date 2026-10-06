---
id: s6-03-music-key-moment
prd: 1108
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

The storyboard names the moment the music should hit, but a free track carries no marker saying where its own big moment is. How is the track lined up with the video?

## The decision, in plain words

Every track's big moment is taken to be eight seconds in, where free tracks have usually left their opening bars, and the track starts early enough for that moment to land on the storyboard's. Without a marked moment, the track starts at its beginning.

## The intro, for fun

The drummer counts in, but nobody wrote down which bar has the cymbal crash.

## The punchline, for fun

We bet on bar eight, like most free songs.

## The options, in plain words

A. A. A track's key moment is taken as eight seconds in (built).
B. B. Each pinned free track records its own key moment, measured once by a person.
C. C. The render finds the first strong beat of the track itself before lining it up.

## What I had to decide

How the music's sync point is placed when a provider gives a track with no beat or key-moment information.

## What I did meanwhile

The render starts the track at (8 s minus the sync point's time in the video), never before its start, and the encode normalises it, fades it in and out and cuts it to the video.

## What it costs to change later

One constant in the music step; a real beat finder or a per-track key moment replaces it without touching anything else.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the sync point to land on the storyboard's key moment but no provider says where a track's own key moment is; eight seconds is a guess at where pinned FreePD tracks leave their intro.
