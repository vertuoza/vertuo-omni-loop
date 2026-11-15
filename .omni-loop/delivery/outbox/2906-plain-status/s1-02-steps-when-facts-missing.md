---
id: s1-02-steps-when-facts-missing
prd: 2906
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The table of how each step is read assumes every fact is known. When the build's progress was not read, or a bug fix's changed files are not known, which step should the status show?

## The decision, in plain words

When a fact is missing, the status shows the earlier step rather than claim progress it cannot see: a feature whose build progress was not read reads Ready to build, and a bug fix whose changed files are not known reads Reproduced, fixing it. The first step of a visual update asks nothing of the person, since nothing says the options are on screen yet.

## The intro, for fun

A status that guesses ahead is a weather forecast for yesterday.

## The punchline, for fun

So when a fact is missing, it stays one step behind.

## The options, in plain words

A. Show the earlier step when a fact is missing, and ask nothing on the options step: what was built.
B. Show the later step the facts allow, such as Building for an approved feature with a draft feature pull request.
C. Show a separate Not known yet step line whenever a fact the step needs is missing.

## What I had to decide

Built in `kit/lib/now/status/steps.ts`. `buildPlace`: an approved PRD with a plan and `slices: null` (no board cached) reads `Questions for you` when questions are open and its feature PR is known, `Ready for your review` on an open feature PR, else `Ready to build`; it never reads `Building` or `Checking it all together` without a board, since a feature PR is opened as a draft by `/omni:plan` before any slice starts. `testsOnly`: a bug fix's draft pull request whose `files` is `null` reads `Reproduced, fixing it`, not `Fix done, checks running`. The visual update's `Showing you options` step has `asks: false` (You: nothing to do right now; Next: you pick one of the options), because no fact says the options are on screen. An empty board (no slice) reads as no slice started.

## What I did meanwhile

Built the earlier-step readings above and tested each in steps.test.ts.

## What it costs to change later

A constant per rule: each reading is one branch of a pure function, with no stored data; s2 can also pass the facts so they are rarely missing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person would rather read a separate word such as Not known yet for the step when the build's progress was not read.
- (author) Whether the visual update's first step should say Waiting for you, since the person is the one who picks.
