---
id: s6-03-roadmap-answer-comment-shape
prd: 1162
slice: s6
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

A person's answer to a roadmap question is left as a comment on the roadmap's issue. What should that comment look like so it can be found again, and which answers should the command accept?

## The decision, in plain words

The comment starts with a fixed hidden tag naming the question, then the answer in plain text, and the latest answer to a question wins. The command only accepts a question the roadmap lists, and an answer of up to a thousand characters.

## The intro, for fun

A comment walks into an issue wearing a name tag.

## The punchline, for fun

Only the last one in the room gets remembered.

## The options, in plain words

A. A fixed tag, the latest answer wins, only listed questions accepted (built)
B. A tag built from the repository's own configured prefix
C. Accept any question name, and let the page sort out unknown ones

## What I had to decide

The answer comment opens with `<!-- omni-roadmap-answer: <question> -->`, a fixed marker rather than one derived from `markers.prefix` (which is the outbox's), so the roadmap's page can write the same comment without reading the repository's config. `readAnswers` keeps the latest marked comment per question in GitHub's order and ignores unmarked ones. `omni roadmap answer` refuses a question the roadmap's Open questions do not list, and an empty or over-1000-character answer, exit 2. `omni roadmap push` is `off` when `ask.url` is unset, as `omni loop push` is; `dossier.enabled` is not read.

## What I did meanwhile

`kit/lib/roadmap/answers.ts` and `omni roadmap answer` build and read that comment; the command's shape, `omni roadmap answer <n> <question> "<answer>"`, is the one s5's answer box copies.

## What it costs to change later

Small: a different marker is one constant in `answers.ts` and in the page's future Send route; answers already posted would need reading under both.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether only some members may answer a person question: anyone who can comment on the issue can today.
