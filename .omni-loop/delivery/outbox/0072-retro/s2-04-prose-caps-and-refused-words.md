---
id: s2-04-prose-caps-and-refused-words
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The spec says each piece of the model's writing has a length limit and a list of refused words, but gives neither the limits nor which word list. Which should the retro use?

## The decision, in plain words

The summary may run to a short paragraph, a title to one line, and each explanation or lesson to a few sentences. The refused words are both lists the joke lines already avoid: the words every delivery file keeps out, and the words that point at a person or a group.

## The intro, for fun

Every writer needs a word count, and this one needed a list of words to stay away from.

## The punchline, for fun

It got both, and the list keeps the writing on what went wrong, never on who was nearby.

## The options, in plain words

A. These caps, and both word lists, the option built.
B. The same caps, refusing only the first list, not the person words.
C. Tighter caps, to keep a retro short enough to read in one sitting.

## What I had to decide

The values `rules` holds for `FIELD_CAPS` and `REFUSED_WORDS`. The spec ("The model, and the guard") says a field is dropped when it "is longer than its cap in `rules`, or holds a word `rules` refuses: the same list of words the kit's question pool may not hold (`kit/lib/outbox/banter.test.mjs`)". It names no cap, and that test holds two lists the pool may not hold: `GAME_WORDS` and `PERSON_OR_TEAM_WORDS`. Nothing after s2 owns `rules`, so s6 reads these as they are.

## What I did meanwhile

`FIELD_CAPS` is summary 1200, title 90, whyItMatters 600, lesson 400 characters. `REFUSED_WORDS` is both kit lists copied word for word; `rules.test.mjs` fails when a copy and the kit's list part. `render`'s own words hold none of them (tested).

## What it costs to change later

Constants in one file, and `RULES_VERSION` bumped so every retro says which rules counted it. Dropping the person words would let a line that blames a role through.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long the model's summaries run in practice; the caps may drop good prose until they are tuned.
- (author) Whether the spec meant only the first list, since the person words make some prose about review threads harder to write.
