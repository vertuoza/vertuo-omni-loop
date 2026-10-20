---
id: s2-01-answers-wire-shape-assumed
prd: 2255
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The two halves of this feature are built side by side: one stores a stopped job's questions and answers, the other asks them and reads them back. Should the asking half keep a guess about what the storing half sends back?

## The decision, in plain words

The asking half sends the issue, a short lead and the questions in one request, and expects back a list of questions, the answers, and the name of whoever answered, and shows the app's own words when it refuses. It stays that way until both halves are merged and can be checked against each other.

## The intro, for fun

Two crews are building one bridge, each from its own bank, in the same week.

## The punchline, for fun

We aimed our planks at where the other bank ought to be.

## The options, in plain words

A. Keep the guess, and check it against the server half once both are merged into the feature branch.
B. Make the kit check every field of the reply now, so a mismatch fails loudly instead of showing up in the skills' wording.
C. Hold the asking half until the storing half is merged, and write it against its real replies.

## What I had to decide

PRD 2255 names the two routes and what the commands exit with, but not the field names. `omni runner ask` posts `{ issue, lead, questions }` to `POST /api/runners/jobs/<job>/questions` and prints the line the stop comment ends on, whose link is `<ask.url>/app/runners?answer=<job>`. `omni runner answers <job>` reads `GET` on the same route, requires a JSON object with an array `questions` and prints it as one line; both skills then name its `answers` and `answeredBy` (the login). s1 owns the server side and was not visible while s2 was built.

## What I did meanwhile

`omni runner answers` is a pass-through of the server's JSON that checks only the `questions` array, so a different spelling of `answers` or `answeredBy` breaks the two skills' text, never the command. The questions themselves are checked kit-side against omni ask's file shape: 1 to 4 questions, each with a header and 2 to 4 options.

## What it costs to change later

A renamed `answers` or `answeredBy` is two words in each of the two skill files and one pinned phrase in `kit/test/need-human-skills.test.ts`; a different request body is one constant in `kit/lib/runner/api.ts` with its tests; the link is one function in `kit/lib/runner/questions.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the exact field names the server slice returns for the answers and for who answered
- (author) whether the server slice builds the link itself or leaves it to the kit
