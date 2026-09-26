---
id: s2-01-letters-take-five-stripes
prd: 100
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The Vertuoza V is drawn in four stripes. How should the other letters of the alphabet be drawn so that each one stays readable?

## The decision, in plain words

Every letter but the V is drawn in five stripes, set closer together, so that letters with a middle stroke, like B, E, H, R and S, keep it. The V stays exactly as it is today.

## The intro, for fun

Most letters have a middle. The V never needed one.

## The punchline, for fun

So the other twenty-five got a fifth stripe, and the V kept its figure.

## The options, in plain words

A. Five stripes, closer together, for every letter but the V. This is what was built.
B. Four stripes spaced like the V's for every letter, accepting that letters with a middle stroke, like B, E and S, read less clearly.
C. Four stripes for the letters that read well with four, and five only for those that need a middle stroke.

## What I had to decide

The spec draws every letter in the V's bars (6-pixel pills with the V's stepped caps, on its 36-pixel grid, under its gradient and shade) and allows other letters to "space their rows differently to stay legible", without saying how. The V has four rows 10 pixels apart. Four rows leave no middle row for B, E, F, H, K, P, R and S, so their middle stroke has to sit high or low, and B, E and R blur together. I drew the whole sheet both ways (four rows and five) and compared them before choosing.

## What I did meanwhile

`LETTERS` in `apps/galaxy/src/arcade/mark.ts`: the V keeps today's four rows (`top: 0, pitch: 10`, pinned run for run against today's `MARK_RUNS` in `mark.test.ts`); every other letter has five rows 7 pixels apart (`top: 1, pitch: 7`, so y 1 to 35, a 1-pixel gap between rows), with stems 11 pixels wide. `bootMark` in `scenes/common.ts` spreads the reveal's row lag over the letter's rows (0.36 from the first row to the last), so a five-row letter is whole at 0.9 s, as the V is; for the V the lag is 0.12 per row, exactly today's. `mark.test.ts` holds every letter inside the 36-pixel box, in the V's pills, with no two bars of a row touching and no two letters alike.

## What it costs to change later

A constant: the glyph table in `mark.ts`. No column holds the letter (the spec), so nothing stored changes, and `mark.test.ts` still pins the V whatever the other letters become.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- nobody but the author has looked at the letters yet: whether a 1-pixel gap between stripes still reads as the brand's stripes at the boot's size is a designer's call (author)
- which letters the next workspaces will need first is not known before PRD 2 opens sign-up (author)
