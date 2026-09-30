---
id: s5-02-proof-comment-gif-link
prd: 798
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

How does the proof comment on the pull request show the moving preview, when the sending step only gives back the page's link?

## The decision, in plain words

The comment shows the moving preview only when the sending step also prints its public link; today it does not, so the comment carries the lines and the page link, and the preview is seen on the page.

## The intro, for fun

The trailer was shot, but nobody wrote down which cinema shows it.

## The punchline, for fun

So the poster goes up without the picture, for now.

## The options, in plain words

A. Leave the GIF out until the push prints its link (built)
B. Change omni proof push to print the GIF's stable link on a second line
C. Have the Proof tab link carry the run id, and build the GIF link from it

## What I had to decide

Whether the skill leaves the GIF out of the comment until omni proof push prints the run's GIF link, or whether that command changes to print it.

## What I did meanwhile

The skill embeds the GIF only when omni proof push prints a second line, the GIF's stable link; today it prints only the Proof tab's link, so no comment embeds a GIF yet.

## What it costs to change later

A small change: omni proof push prints <ask.url>/api/proofs/<run id>/preview.gif as a second line when the run holds preview.gif, and the skill already reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for the GIF embedded from its stable link, which needs the run id; the server mints it and omni proof push, outside this slice, never prints it.
