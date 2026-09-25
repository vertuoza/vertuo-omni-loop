---
id: s6-03-what-the-guard-counts-as-copied
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec lets the model's writing hold a number only inside a quoted name copied from the evidence. What counts as copied, and may the model point to the evidence it was given?

## The decision, in plain words

A quoted name counts as copied when it appears word for word in the evidence, or is the name of a finding, and holds at least one letter, so a bare number never passes. A link to the evidence is let through, any other link drops the sentence, and a refused sentence is replaced by a line giving the reason, never the refused words.

## The intro, for fun

A number in quotes is still a number, even when it dresses up as a name.

## The punchline, for fun

So a quoted name gets in only with a letter in it, and its ticket must match the evidence.

## The options, in plain words

A. Names copied from the evidence that hold a letter, and links to the evidence, let through, the option built.
B. Only quoted names let through, so a sentence with any link is dropped for its digits.
C. Any quoted text found in the evidence let through, bare numbers included.

## What I had to decide

`guard`'s digit and link rules. The spec says a field is dropped when it "holds a digit, once backtick spans copied verbatim from the evidence are set aside" and when it "carries a link that is not one of the evidence URLs". An evidence URL almost always holds digits, so read literally no link could pass; and a span like `7001` is verbatim inside a run's URL, so read loosely any number from a URL could pass.

## What I did meanwhile

`guard` in `src/retro/guard.mjs`: the evidence is every finding's evidence labels, URLs and excerpts, plus the finding ids. A backtick span is set aside when it holds a letter and appears in that evidence; an evidence URL is set aside too. A field breaking several rules is dropped for the first, in the order not text, too long, refused word, foreign link, unknown finding, digit. Reasons are fixed sentences (`DROPPED`: "it holds a digit"…) that never quote the model. A refused lesson of the list keeps its place as the line `render` writes for any dropped field (`_Dropped: <reason>._`), citing only findings the retro found, since the prose contract has no dropped form for it. Refused words are checked on the whole field, spans included.

## What it costs to change later

Constants and one function in `guard.mjs`, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec meant links to the evidence to be dropped for their digits; the model is asked for no links at all, so this seldom matters.
