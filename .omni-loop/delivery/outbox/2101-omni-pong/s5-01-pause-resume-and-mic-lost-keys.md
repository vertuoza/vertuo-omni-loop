---
id: s5-01-pause-resume-and-mic-lost-keys
prd: 2101
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

When a paused match resumes, which key asks for the microphone again, and how does a player leave a match whose microphone was lost?

## The decision, in plain words

START on the pause asks for the microphone again and the match plays on as soon as it is granted; a refusal keeps the pause up with the reason under it. On MIC LOST, A asks again and SELECT quits, sending the score, as it does on the pause.

## The intro, for fun

The match is frozen, the recording light is off, and the player wants back in.

## The punchline, for fun

One key wakes the microphone, another lets you walk away with your points.

## The options, in plain words

A. A. START resumes and asks for the microphone; MIC LOST takes A to retry and SELECT to quit.
B. B. A asks for the microphone on the pause, then START resumes; MIC LOST takes A only.
C. C. As A, and B leaves for the room from the pause and MIC LOST, with the score sent.

## What I had to decide

Keep START as the one key that resumes, and add SELECT to MIC LOST so a player without a microphone can still end the match and keep the score.

## What I did meanwhile

START resumes the pause by asking for the microphone; MIC LOST takes A to ask again and SELECT to quit. B does nothing during a match.

## What it costs to change later

A constant change in the game's press table (pong/art.ts) and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the microphone is asked for again with A when play resumes, and also that only START resumes: START was taken so the pause screen has one key to resume (author).
- The spec gives MIC LOST only A to retry; SELECT · QUIT was added so a player whose microphone is gone is never stuck (author).
- A pause from outside on the game over stops the microphone too, so A then plays again with it off (author).
