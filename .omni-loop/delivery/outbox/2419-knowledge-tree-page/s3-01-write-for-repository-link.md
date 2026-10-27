---
id: s3-01-write-for-repository-link
prd: 2419
slice: s3
rank: medium
bears-on: none
raised: 2026-10-27
wave: 2
---

## The question, in plain words

The Write it for this repository link opens a blank new page in the repository, not one that starts from the text the page reads today. Is that enough for now?

## The decision, in plain words

The link opens GitHub's new-file page on the repository's own path for that page, so the person proposes it as a pull request. It does not carry the text the page reads today, because the section's model does not hold page text.

## The intro, for fun

A blank page is a fine start, but a head start is better.

## The punchline, for fun

Copying the text over would save one paste.

## The options, in plain words

A. A. A link to an empty new file at the repository's own path, as built.
B. B. A follow-up slice that adds each page's text to the model and starts the file from it.

## What I had to decide

Carrying the text needs the section's model (repositories-section) to hand each page's text to the view, which is outside this slice. Take the link as built, or ask for a follow-up slice that adds the text to the model and to the link.

## What I did meanwhile

The link opens an empty file at the right path in the repository; the person pastes the text from the page they read.

## What it costs to change later

One small follow-up slice: the model gains each page's text, the link gains a value parameter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The pull request does not start from the text the page reads today (author)
- GitHub's new/HEAD address is assumed to open the repository's default branch (author)
