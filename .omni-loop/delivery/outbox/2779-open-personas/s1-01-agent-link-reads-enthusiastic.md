---
id: s1-01-agent-link-reads-enthusiastic
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

The old word is kept only for older terminals that read the business. Should agents connected through the agent link, and the review check on pull requests, also be sent the old word, or the new one?

## The decision, in plain words

They read the new word, enthusiastic. Only the terminal's business read sends the old word back, and only to a kit that does not ask for the new one.

## The intro, for fun

One persona, two words for how happy they are.

## The punchline, for fun

Only the oldest readers still hear the old word.

## The options, in plain words

A. A. The agent link and the review check read enthusiastic; only the terminal's business read sends excited to an older kit.
B. B. The agent link also sends excited unless it is asked for the new word.
C. C. Every read sends excited unless asked, the review check included.

## What I had to decide

Keep A when agents on the link and the review check may read enthusiastic. Pick B when they too must read excited unless they ask, which adds the same switch to the agent link.

## What I did meanwhile

Agents on the link read enthusiastic, neutral or skeptical. The review check passes the stance as plain text, so any word reads.

## What it costs to change later

B is a small change to the agent link's read, a few lines and a test; nothing is stored differently either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the old-kit switch for the terminal's business read only; it says nothing of the agent link or the review check (author).
- The review check reads any stance word as text, so it needs nothing either way.
