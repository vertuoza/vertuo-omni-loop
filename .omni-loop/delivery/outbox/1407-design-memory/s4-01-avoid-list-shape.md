---
id: s4-01-avoid-list-shape
prd: 1407
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

How does a team write down, on its design page, the words its product never uses, so that the word check can find them?

## The decision, in plain words

The check only reads a list that is clearly labelled as one: a line such as "Words we avoid:" followed by the words, or that label followed by one bullet per word. A sentence that just mentions avoiding something is never read as a list.

## The intro, for fun

Every product has words it would rather never say out loud.

## The punchline, for fun

We only listen when the list says it is a list.

## The options, in plain words

A. A. A labelled line (Words we avoid:, Words to avoid:, Avoided words: or Avoid:) with the words after it, or the label alone with one bullet per word below it
B. B. Only the config list; the design page is never read for avoided words
C. C. A dedicated sub-heading under the product part, with one bullet per word

## What I had to decide

Whether the labelled line (or labelled bullet list) is the shape a team writes its avoided words in on the design page, or whether the page should hold them some other way.

## What I did meanwhile

The word check reads avoided words from the config list and from a labelled line or bullet list in the product part of the design page; anything else there is ignored.

## What it costs to change later

Changing the accepted shape later is a change to one small reader and its tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit's design page template does not yet show this shape in its product hint; that template belongs to another slice (author)
- The guide page that explains the word check is written in a later slice and should show the shape (author)
