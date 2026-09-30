---
id: s1-03-contradicted-left-out-of-sentence
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

In the terminal, the business is shown as one sentence and a list. Should a claim the evidence now disputes appear in the sentence?

## The decision, in plain words

No: it stays in the list, marked as contradicted, and the sentence is made from confirmed claims only, so an agent never states it as settled.

## The intro, for fun

The pricing page says CRM, the old answer says ERP, and nobody has picked yet.

## The punchline, for fun

Until someone answers, the sentence keeps quiet about it.

## The options, in plain words

A. Leave it out of the sentence, mark it on its line
B. Keep it in the sentence with a mark, such as 'ERP (disputed)'

## What I had to decide

Whether a disputed claim belongs in the terminal's sentence while nobody has answered.

## What I did meanwhile

The sentence leaves a disputed claim out (a blank if it was the only one); its line says 'contradicted: evidence disagrees, nobody answered yet'. The JSON form carries it with its state.

## What it costs to change later

A one-line change in how the command builds the sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says agents read a contradicted claim marked as such, not how the sentence shows it (author).
