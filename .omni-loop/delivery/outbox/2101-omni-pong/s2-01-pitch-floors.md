---
id: s2-01-pitch-floors
prd: 2101
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

How loud and how clear must a sound be before the game reads it as a voice that steers the paddle?

## The decision, in plain words

A sound steers only when it is clearly louder than a quiet room and clearly a held note: speech, breath and hiss steer nothing. The two thresholds sit beside the pitch limits so they can be retuned in one place.

## The intro, for fun

Somewhere between a whisper and an opera there is a voice that moves a paddle.

## The punchline, for fun

We picked where the quiet ends; your open space may want a say.

## The options, in plain words

A. A. Keep the thresholds as built: a sound a little louder than a quiet room, and clearly a held note, steers.
B. B. Ask for a clearer note, so only a steady hum steers, at the price of a wavering voice dropping out.
C. C. Ask for a louder sound, so a quiet room steers less, at the price of a soft voice having to hum louder.

## What I had to decide

Keep the two thresholds as built, or set new ones after a person has played a few matches on a laptop microphone and a headset.

## What I did meanwhile

The game reads a sound whose loudness is at least 0.01 (RMS of samples in -1..1) and whose normalised autocorrelation peak is at least 0.8; the first peak within 90 % of the highest is taken as the period, so a voice is not read an octave low.

## What it costs to change later

A constant in one file (apps/galaxy/src/arcade/pong/rules.ts, PITCH.loudnessFloor, clarityFloor, peakShare); no stored data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Tuned on synthesised sines and seeded white noise only; not yet heard against a real voice or a noisy room (author).
