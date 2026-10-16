---
id: s3-01-match-tuning
prd: 2101
slice: s3
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

How fast should the ball get, and how slow should the computer opponent react, so a rally feels fair and still ends?

## The decision, in plain words

The ball starts gently, speeds up a little at every hit up to a firm cap, and the computer reacts a quarter of a second late, so it starts missing once the rally gets fast.

## The intro, for fun

Somebody had to decide how sleepy the robot is.

## The punchline, for fun

A quarter of a second of daydreaming, and it is still a better player than most of us.

## The options, in plain words

A. A. Keep these numbers (built).
B. B. A gentler match: a slower cap and a slower speed-up, so rallies last longer before the AI misses.
C. C. A harder match: a shorter AI delay or a faster AI, so points come later in a rally.

## What I had to decide

Keep the numbers in the match's constants block, or name new ones there: the ball's serve speed, its speed-up per hit and its cap, the opponent's delay and top speed, the paddle sizes and the serve angles.

## What I did meanwhile

The match plays with these numbers: serve 150 px/s, ×1.07 per return, cap 480 px/s, the AI 0.25 s late at 160 px/s, the player at 220 px/s, paddles 40 px tall, serves between 0.25 and 0.6 rad. A test proves the AI misses before the ball reaches its cap for 200 seeds.

## What it costs to change later

A constant: every number sits in one block of the rules file, and the tests read them from there.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The numbers were chosen by reasoning and checked by the tests only; nobody has played a match with a real voice yet. The feel is a person's check once s5 puts the match on screen.
- (author) The spec's 'no death earns a point' test is read as: a player who concedes three balls in a row from a given rally never ends higher than the same reading player who misses none, for 200 seeds and four rallies; a concession also never changes the score, at every concession of 200 matches.
