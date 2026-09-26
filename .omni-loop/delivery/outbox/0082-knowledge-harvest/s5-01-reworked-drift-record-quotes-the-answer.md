---
id: s5-01-reworked-drift-record-quotes-the-answer
prd: 82
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When a person asked for a change and the team reworked it, what should the written decision say was chosen?

## The decision, in plain words

The written decision quotes the person's answer word for word, instead of the first option, which was what got built before the change.

## The intro, for fun

The first option lost the argument, so it should not get the last word.

## The punchline, for fun

The person who asked for the change gets quoted instead.

## The options, in plain words

A. Quote the answer verbatim for a reworked drift, option A otherwise (what was built).
B. Always quote option A, even for a reworked drift.
C. Ask the model to name the chosen option in its reply, and quote that.

## What I had to decide

The spec says a decision record's Decision section ends with the option chosen, verbatim. For a decision kept as built that is option A. For a drifted decision that was reworked, option A is what the person rejected, and the answer rarely names a letter.

## What I did meanwhile

A record from a drifted, reworked decision ends its Decision section with 'The answer, as it was given:' and the answer verbatim; every other record ends with 'The option chosen:' and option A verbatim.

## What it costs to change later

One function in kit/lib/knowledge/write.mjs and one test; records already merged keep their text until a person edits them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say which option a reworked drift chose; nothing in the ledger maps a free-text answer back to an option letter.
