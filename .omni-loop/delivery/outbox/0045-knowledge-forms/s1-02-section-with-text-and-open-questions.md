---
id: s1-02-section-with-text-and-open-questions
prd: 45
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When a section of a form holds written guidance and also an open question for a person, which one should an agent read?

## The decision, in plain words

The agent reads the written guidance, with the open question kept in place and still counted, so nothing the repository wrote is hidden behind the shared default.

## The options, in plain words

A. The written guidance shows, with the open question in place, and the question is still listed for a person.
B. The section counts as unanswered: the shared default shows, then the question, and the written guidance is hidden.
C. The check refuses a section that mixes the two, so a person must split them.

## What I had to decide

The spec's resolution table has one row for a filled section and one for a section holding `TODO(human)` lines (the kit default, then each question, labelled `[hole]`), and its example hole holds nothing else. It does not say what a section holding both repository text and a `TODO(human)` line is. The parser's reading decides what `omni kb show` (s3) prints and what `omni kb status` counts as an open question. Separately, the spec does not say whether an HTML comment in a body is content; the parser treats it as not content, since it renders as nothing.

## What I did meanwhile

`parseForm` in `kit/lib/playbook/forms.mjs` reads a body as `holes` only when every non-blank line is a `TODO(human):` line; a body with any other text is `text`, its `questions` still listing each `TODO(human)` line, and `resolveForm` labels it `[repo]` with the text as written. HTML comments are stripped before a body is read, so a comment-only body is `empty`. Tests: "reads text beside an open question as text, and still lists the question" and "reads a missing body, blank lines and comments alone as empty" in `kit/lib/playbook/forms.test.mjs`.

## What it costs to change later

A constant: which kind `readBody` returns for a mixed body is one condition and a test, before or after merge; no stored data depends on it. Forms already in a repository are read the new way at once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether terraform (s5) will ever write a section that mixes the two: the spec's own examples keep them apart.
