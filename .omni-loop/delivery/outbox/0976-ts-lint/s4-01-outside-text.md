---
id: s4-01-outside-text
prd: 976
slice: s4
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

When a reply, an answer or a path reaches the tool as something other than plain text, should the tool keep writing it out as the odd placeholder it produced before, or treat it as empty?

## The decision, in plain words

Such a value is now read as empty, so the tool refuses or ignores it instead of writing a meaningless placeholder into a reply, an account or a check.

## The intro, for fun

Somebody handed the tool a box where it expected a word.

## The punchline, for fun

It now says the box is empty instead of reading the label on the lid.

## The options, in plain words

A. Read a value that is not text, a number or a boolean as empty, so it is refused or ignored.
B. Keep writing such a value out as before, through a helper that stringifies whatever it is given.
C. Refuse such a value with a named error wherever it reaches the tool.

## What I had to decide

How kit/lib/outbox and kit/lib/policy read a value handed in from outside as text, where `String(value ?? '')` wrote an object out as `[object Object]` and the linter refuses that stringification.

## What I did meanwhile

`plainText` in `kit/lib/outbox/plain-text.ts` reads a string as it is, a number or a boolean written out, and anything else as ''. It replaces `String(value ?? '')` in `cleanLine`, `parseReplyLines`, `interpretAnswer`, phase-0's `normalize` and `beforeAfterHandoff`; an account's id or where is read only when it is text. Text, numbers and nothing read exactly as before.

## What it costs to change later

One function, `plainText` in `kit/lib/outbox/plain-text.ts`: making it write an object out again changes every caller at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a value from outside is widened or parsed, and that a fix changes no output; it does not say what a value that is neither text, a number nor nothing should read as, the one case where the output moves.
