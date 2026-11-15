---
id: s3-01-guide-paraphrases-key-whys
prd: 2915
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

Is it right that the user guide paraphrases two of the reasons a job of a key's App fails with, instead of quoting them word for word, because the guide's own check refuses the word "private" on every page?

## The decision, in plain words

Yes: the API guide says the server has no key to open the App's key, or that the App's key could not be opened, while the code keeps the spec's exact words, which say "private key". The guide's check (PRD 459) refuses "private" on every page, so that no page ever asks for read access to a private repository.

## The intro, for fun

The guide was told never to whisper a certain word, so it learned a synonym.

## The punchline, for fun

The server still says it in full; the guide just mumbles the middle.

## The options, in plain words

A. Keep the paraphrase (built).
B. Narrow the guide check to private repositories, and quote the two reasons word for word.

## What I had to decide

Answer A to keep the paraphrase. Answer B to let the guide quote the two reasons word for word: the guide check's pattern is narrowed so it refuses a private repository, not a private key, and the two rows quote the code.
Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

The guide paraphrases the two reasons; every other reason is quoted as the code writes it.

## What it costs to change later

Small: two table rows and one line of a test, no data to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the guide check's ban on "private" is meant for every use of the word, or only for asking for access to a private repository, is not written anywhere: PRD 459's test is the only record.
